import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, query, onSnapshot, orderBy, limit 
} from 'firebase/firestore';
import { useAuth } from './useAuth';
import { 
  AppNotification, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification,
  requestBrowserNotificationPermission
} from '../services/notificationService';

export function useNotifications() {
  const { profile, isOwner, isStaff } = useAuth();
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  useEffect(() => {
    if (!profile?.uid) {
      setAllNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const notifsRef = collection(db, 'notifications');
    let unsub: (() => void) | null = null;

    const attachListener = (useOrder: boolean) => {
      try {
        const q = useOrder 
          ? query(notifsRef, orderBy('createdAt', 'desc'), limit(100))
          : notifsRef;

        return onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          })) as AppNotification[];

          // Guarantee reverse chronological order
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          // Filter relevant to current user
          const userItems = items.filter(item => {
            if (!item) return false;
            if (item.userId === profile.uid) return true;
            if (isOwner && (item.userId === 'all_owners' || item.userId === 'all_staff' || !item.userId)) return true;
            if (isStaff && (item.userId === 'all_staff' || !item.userId)) return true;
            if (item.role && (item.role === profile.role || item.role === 'all')) return true;
            return false;
          });

          setAllNotifications(userItems);
          setLoading(false);
        }, (err) => {
          console.error('Error listening to notifications:', err);
          if (useOrder) {
            // Retry without orderBy in case of indexing or schema issue
            unsub = attachListener(false);
          } else {
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('Failed to attach notification listener:', err);
        setLoading(false);
        return () => {};
      }
    };

    unsub = attachListener(true);

    return () => {
      if (unsub) unsub();
    };
  }, [profile?.uid, isOwner, isStaff, profile?.role]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  const requestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermission(res);
    return res;
  };

  const markAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await markAllNotificationsAsRead(allNotifications);
    setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = async (id: string) => {
    await deleteNotification(id);
    setAllNotifications(prev => prev.filter(n => n.id !== id));
  };

  return {
    notifications: allNotifications,
    unreadCount,
    loading,
    permission,
    requestPermission,
    markAsRead,
    markAllRead,
    removeNotification
  };
}
