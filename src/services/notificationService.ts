import { db } from '../lib/firebase';
import { 
  collection, addDoc, doc, updateDoc, deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

export type NotificationType = 
  | 'inquiry' 
  | 'chat' 
  | 'project' 
  | 'payment' 
  | 'worker' 
  | 'system';

export interface AppNotification {
  id: string;
  userId: string; // Target user UID, or 'all_owners', 'all_staff'
  role?: string;
  title: string;
  body: string;
  link?: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface SendNotificationParams {
  userId: string; // specific user UID or 'all_owners' / 'all_staff'
  role?: string;
  title: string;
  body: string;
  link?: string;
  type?: NotificationType;
  metadata?: Record<string, any>;
}

/**
 * Triggers a browser native Web Notification if permission is granted.
 */
export function triggerBrowserNotification(title: string, body?: string, link?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body: body || 'Pamnim Interiors Notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
      if (link) {
        n.onclick = () => {
          window.focus();
          window.location.href = link;
        };
      }
    } catch (e) {
      console.warn('Native notification trigger failed:', e);
    }
  }
}

/**
 * Requests native browser notification permission.
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Could not request notification permission:', err);
    return Notification.permission;
  }
}

/**
 * Creates an in-app notification in Firestore and attempts to trigger a native notification.
 */
export async function createNotification(params: SendNotificationParams): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      userId: params.userId,
      role: params.role || 'all',
      title: params.title,
      body: params.body,
      link: params.link || '',
      type: params.type || 'system',
      read: false,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    });

    // Also attempt browser alert if supported
    triggerBrowserNotification(params.title, params.body, params.link);

    return docRef.id;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
  }
}

/**
 * Mark multiple notifications as read.
 */
export async function markAllNotificationsAsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter(n => !n.read);
  if (unread.length === 0) return;

  try {
    const batch = writeBatch(db);
    unread.forEach(n => {
      const ref = doc(db, 'notifications', n.id);
      batch.update(ref, { read: true, readAt: new Date().toISOString() });
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
}

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (err) {
    console.error('Failed to delete notification:', err);
  }
}
