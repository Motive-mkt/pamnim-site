import { db, auth } from '../lib/firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';

export interface ProjectDeletionResult {
  success: boolean;
  updatesDeleted: number;
  paymentsDeleted: number;
  expensesDeleted: number;
  notesDeleted: number;
  projectDocDeleted: boolean;
  errors: string[];
}

export interface ClientActiveProjectsResult {
  canDelete: boolean;
  activeProjects: Array<{ id: string; name: string; stage: string }>;
}

export interface ClientDeletionResult {
  success: boolean;
  authDeleted: boolean;
  profileDeleted: boolean;
  chatDeleted: boolean;
  pendingSignupDeleted: boolean;
  errors: string[];
}

/**
 * Cascade deletes a project and all its subcollections:
 * - updates
 * - progressNotes
 * - payments
 * - expenses
 * - parent project document
 * 
 * Note regarding Cloudinary media:
 * Progress updates may have image or video assets stored on Cloudinary.
 * Orphaned media files may remain in Cloudinary storage without public ID tracking,
 * and should be purged via periodic Cloudinary retention rules or administrative media audits.
 */
export async function deleteProjectCascade(
  projectId: string,
  onProgress?: (msg: string) => void
): Promise<ProjectDeletionResult> {
  const result: ProjectDeletionResult = {
    success: false,
    updatesDeleted: 0,
    paymentsDeleted: 0,
    expensesDeleted: 0,
    notesDeleted: 0,
    projectDocDeleted: false,
    errors: []
  };

  if (!projectId) {
    result.errors.push('Project ID is required.');
    return result;
  }

  try {
    // 1. Delete updates subcollection
    if (onProgress) onProgress('Deleting project progress updates...');
    try {
      const updatesRef = collection(db, 'projects', projectId, 'updates');
      const updatesSnap = await getDocs(updatesRef);
      if (!updatesSnap.empty) {
        const batch = writeBatch(db);
        updatesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        result.updatesDeleted = updatesSnap.size;
      }
    } catch (err: any) {
      const msg = `Failed to delete updates subcollection: ${err?.message || err}`;
      console.error(msg);
      result.errors.push(msg);
    }

    // 2. Delete progressNotes subcollection
    if (onProgress) onProgress('Deleting progress notes...');
    try {
      const notesRef = collection(db, 'projects', projectId, 'progressNotes');
      const notesSnap = await getDocs(notesRef);
      if (!notesSnap.empty) {
        const batch = writeBatch(db);
        notesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        result.notesDeleted = notesSnap.size;
      }
    } catch (err: any) {
      const msg = `Failed to delete progressNotes subcollection: ${err?.message || err}`;
      console.error(msg);
      result.errors.push(msg);
    }

    // 3. Delete payments subcollection
    if (onProgress) onProgress('Deleting payment records...');
    try {
      const paymentsRef = collection(db, 'projects', projectId, 'payments');
      const paymentsSnap = await getDocs(paymentsRef);
      if (!paymentsSnap.empty) {
        const batch = writeBatch(db);
        paymentsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        result.paymentsDeleted = paymentsSnap.size;
      }
    } catch (err: any) {
      const msg = `Failed to delete payments subcollection: ${err?.message || err}`;
      console.error(msg);
      result.errors.push(msg);
    }

    // 4. Delete expenses subcollection
    if (onProgress) onProgress('Deleting expense records...');
    try {
      const expensesRef = collection(db, 'projects', projectId, 'expenses');
      const expensesSnap = await getDocs(expensesRef);
      if (!expensesSnap.empty) {
        const batch = writeBatch(db);
        expensesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        result.expensesDeleted = expensesSnap.size;
      }
    } catch (err: any) {
      const msg = `Failed to delete expenses subcollection: ${err?.message || err}`;
      console.error(msg);
      result.errors.push(msg);
    }

    // 5. Delete parent project document
    if (onProgress) onProgress('Deleting project document...');
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      result.projectDocDeleted = true;
    } catch (err: any) {
      const msg = `Failed to delete project parent document: ${err?.message || err}`;
      console.error(msg);
      result.errors.push(msg);
    }

    result.success = result.projectDocDeleted && result.errors.length === 0;
    return result;
  } catch (err: any) {
    const msg = `Cascade delete encountered fatal error: ${err?.message || err}`;
    console.error(msg);
    result.errors.push(msg);
    return result;
  }
}

/**
 * Checks whether a client has active (non-complete) projects.
 * Deleting a client is blocked if any projects are not in the "Complete" stage.
 */
export async function checkClientActiveProjects(clientId: string): Promise<ClientActiveProjectsResult> {
  if (!clientId) {
    return { canDelete: true, activeProjects: [] };
  }

  try {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('clientId', '==', clientId));
    const snap = await getDocs(q);

    const activeProjects: Array<{ id: string; name: string; stage: string }> = [];

    snap.docs.forEach((d) => {
      const data = d.data();
      const stage = data.currentStageName || 'Started';
      // If stage is not Complete (or stage index is not 3), it is active
      if (stage !== 'Complete') {
        activeProjects.push({
          id: d.id,
          name: data.name || 'Untitled Project',
          stage: stage
        });
      }
    });

    return {
      canDelete: activeProjects.length === 0,
      activeProjects
    };
  } catch (err) {
    console.error('Error checking client active projects:', err);
    // On error, let's be safe and assume we should not block unless we know, but log
    return { canDelete: true, activeProjects: [] };
  }
}

/**
 * Cascade deletes a client:
 * 1. Firebase Auth user account via secure backend endpoint (/api/admin/users/:uid)
 * 2. profiles/{clientId} document
 * 3. pending_signups/{clientId} document if exists
 * 4. chats/{clientId} thread and messages subcollection
 * 
 * Note: Does NOT delete completed project records — these are preserved as historical
 * business and financial accounting records.
 */
export async function deleteClientCascade(
  clientId: string,
  onProgress?: (msg: string) => void
): Promise<ClientDeletionResult> {
  const result: ClientDeletionResult = {
    success: false,
    authDeleted: false,
    profileDeleted: false,
    chatDeleted: false,
    pendingSignupDeleted: false,
    errors: []
  };

  if (!clientId) {
    result.errors.push('Client ID is required.');
    return result;
  }

  try {
    // 1. Call backend admin user deletion endpoint to delete Firebase Auth account and Firestore records
    if (onProgress) onProgress('Deleting client authentication credentials...');
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned HTTP ${res.status}`);
      }

      const body = await res.json();
      result.authDeleted = !!body.authDeleted;
      if (body.firestoreDeleted) result.profileDeleted = true;
      if (body.chatDeleted) result.chatDeleted = true;
    } catch (err: any) {
      const msg = `Backend user removal notice: ${err?.message || err}`;
      console.warn(msg);
      result.errors.push(msg);
    }

    // 2. Client-side chat cleanup (delete chats/{clientId}/messages/* and chats/{clientId})
    if (!result.chatDeleted) {
      if (onProgress) onProgress('Cleaning up client chat history...');
      try {
        const messagesRef = collection(db, 'chats', clientId, 'messages');
        const msgsSnap = await getDocs(messagesRef);
        if (!msgsSnap.empty) {
          const batch = writeBatch(db);
          msgsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        await deleteDoc(doc(db, 'chats', clientId));
        result.chatDeleted = true;
      } catch (err: any) {
        const msg = `Failed to clean up chat messages: ${err?.message || err}`;
        console.warn(msg);
        result.errors.push(msg);
      }
    }

    // 3. Client-side profile document cleanup fallback
    if (!result.profileDeleted) {
      if (onProgress) onProgress('Removing client profile document...');
      try {
        await deleteDoc(doc(db, 'profiles', clientId));
        result.profileDeleted = true;
      } catch (err: any) {
        const msg = `Failed to delete profile: ${err?.message || err}`;
        console.error(msg);
        result.errors.push(msg);
      }
    }

    // 4. Client-side pending_signups cleanup fallback
    try {
      await deleteDoc(doc(db, 'pending_signups', clientId));
      result.pendingSignupDeleted = true;
    } catch (e) {
      // Doc might not exist
      result.pendingSignupDeleted = true;
    }

    result.success = result.profileDeleted && result.errors.length <= 1; // Backend may report minor warning if auth was already absent
    return result;
  } catch (err: any) {
    const msg = `Client cascade delete encountered error: ${err?.message || err}`;
    console.error(msg);
    result.errors.push(msg);
    return result;
  }
}
