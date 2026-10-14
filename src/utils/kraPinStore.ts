import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Remember a client's / lead's KRA PIN on their record so it pre-fills next time.
// Best effort: a failed save must never block creating the document itself.
export async function persistKraPin(
  kind: 'client' | 'lead',
  id: string,
  pin: string
): Promise<boolean> {
  if (!id || !pin) return false;
  try {
    await updateDoc(doc(db, kind === 'client' ? 'profiles' : 'leads', id), {
      kraPin: pin,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.warn(`Could not save KRA PIN to ${kind} record:`, err);
    return false;
  }
}
