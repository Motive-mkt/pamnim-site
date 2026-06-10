import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'owner' | 'senior_designer' | 'designer' | 'project_manager' | 'client';

interface Profile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  assignedProjectIds?: string[];
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'profiles', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const adminEmails = ['jessescaledyou@gmail.com', 'your-admin-email@example.com'];
            const isInitialAdmin = user.email && adminEmails.includes(user.email.toLowerCase().trim());
            
            if (isInitialAdmin && data.role !== 'owner') {
              try {
                await setDoc(docRef, { role: 'owner' }, { merge: true });
                setProfile({ uid: user.uid, ...data, role: 'owner' } as Profile);
              } catch (upgradeErr) {
                console.warn("Failed to auto-upgrade in useAuth:", upgradeErr);
                setProfile({ uid: user.uid, ...data } as Profile);
              }
            } else {
              setProfile({ uid: user.uid, ...data } as Profile);
            }
          } else {
            const adminEmails = ['jessescaledyou@gmail.com', 'your-admin-email@example.com'];
            const isInitialAdmin = user.email && adminEmails.includes(user.email.toLowerCase().trim());
            try {
              const newProfileData = {
                uid: user.uid,
                email: user.email || '',
                name: user.displayName || (isInitialAdmin ? 'Owner' : 'Client'),
                role: (isInitialAdmin ? 'owner' : 'client') as UserRole,
                status: 'active',
                createdAt: new Date().toISOString()
              };
              await setDoc(docRef, newProfileData);
              setProfile(newProfileData as Profile);
            } catch (createErr) {
              console.warn("Failed to auto-create profile:", createErr);
            }
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isAdmin = profile?.role === 'owner';
  const isStaff = profile?.role !== 'client' && profile?.role !== undefined;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
