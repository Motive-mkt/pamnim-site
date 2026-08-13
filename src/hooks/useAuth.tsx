import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'owner' | 'elevated_employee' | 'regular_employee' | 'senior_designer' | 'designer' | 'project_manager' | 'client' | 'pending';

export interface Profile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  whatsapp?: string;
  assignedProjectIds?: string[];
  status?: 'active' | 'pending';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isOwner: boolean;
  isElevatedEmployee: boolean;
  isRegularEmployee: boolean;
  canApproveSignups: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
  isOwner: false,
  isElevatedEmployee: false,
  isRegularEmployee: false,
  canApproveSignups: false,
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
            setProfile({ uid: user.uid, ...data } as Profile);
          } else {
            try {
              const ownerQuery = query(collection(db, 'profiles'), where('role', '==', 'owner'));
              const ownerSnap = await getDocs(ownerQuery);
              const isFirstOwner = ownerSnap.empty;

              const newRole: UserRole = isFirstOwner ? 'owner' : 'client';
              const newName = user.displayName || (isFirstOwner ? 'Owner' : 'Client');

              const newProfileData = {
                uid: user.uid,
                email: user.email || '',
                name: newName,
                role: newRole,
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

  const isOwner = profile?.role === 'owner';
  const isElevatedEmployee = profile?.role === 'elevated_employee';
  const isRegularEmployee = profile?.role === 'regular_employee' || profile?.role === 'senior_designer' || profile?.role === 'designer' || profile?.role === 'project_manager';
  const isAdmin = isOwner;
  const isStaff = isOwner || isElevatedEmployee || isRegularEmployee;
  const canApproveSignups = isOwner || isElevatedEmployee;

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isStaff, isOwner, isElevatedEmployee, isRegularEmployee, canApproveSignups }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
