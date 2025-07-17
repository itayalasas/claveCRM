
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where, DocumentData, Timestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';


export interface User extends DocumentData {
  id: string;
  email: string;
  name: string; // Changed to required
  tenantId: string; // Changed to required
  role: string;
  createdAt?: string;
}

export interface Role extends DocumentData {
  id: string;
  name: string;
  permissions: string[];
}

export interface StoredLicenseInfo extends DocumentData {
  status: 'active' | 'expired' | 'trial' | 'cancelled' | 'not_configured' | string;
  expiryDate?: Timestamp | string; // Allow both Timestamp and string for flexibility
  maxUsersAllowed?: number;
  type?: string;
  licenseKey?: string;
}

export type EffectiveLicenseStatus = 'active' | 'expired' | 'no_license' | 'limit_reached' | 'pending' | 'not_configured' | 'cancelled';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isUserDataLoaded: boolean;
  userPermissions: string[];
  licenseInfo: StoredLicenseInfo | null;
  effectiveLicenseStatus: EffectiveLicenseStatus;
  userCount: number | null;
  login: (email: string, pass: string) => Promise<FirebaseUser | null>;
  signup: (email: string, pass: string, name: string, targetRole: Role, adminPerformingSignup?: User | null) => Promise<FirebaseUser | null>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  unreadInboxCount: number | null;
  isLoadingUnreadCount: boolean;
  getAllUsers: () => Promise<User[]>; // For centralizing user fetching
  updateUserInFirestore: (userId: string, data: Partial<User>, adminUser: User | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [licenseInfo, setLicenseInfo] = useState<StoredLicenseInfo | null>(null);
  const [effectiveLicenseStatus, setEffectiveLicenseStatus] = useState<EffectiveLicenseStatus>('pending');
  const [userCount, setUserCount] = useState<number | null>(null);
  const [unreadInboxCount, setUnreadInboxCount] = useState<number | null>(0);
  const [isLoadingUnreadCount, setIsLoadingUnreadCount] = useState(true);

  const calculateEffectiveLicenseStatus = useCallback(
    (license: StoredLicenseInfo | null, count: number | null) => {
      if (!license || !license.status || license.status === 'not_configured') return 'no_license';
      if (license.status === 'cancelled') return 'cancelled';
      
      const expiryDate = license.expiryDate;
      if (expiryDate && (expiryDate instanceof Timestamp ? expiryDate.toDate() : new Date(expiryDate)) < new Date()) {
        return 'expired';
      }

      const maxUsers = license.maxUsersAllowed;
      if (typeof maxUsers === 'number' && maxUsers > 0 && typeof count === 'number' && count > maxUsers) {
        return 'limit_reached';
      }
      
      if (license.status === 'active' || license.status === 'trial') return license.status;

      return 'not_configured'; // Fallback for other non-active statuses
    },
    []
  );

  useEffect(() => {
    console.log("AUTH_CONTEXT: onAuthStateChanged listener setup.");
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("AUTH_CONTEXT: onAuthStateChanged triggered. fbUser:", fbUser ? fbUser.uid : "null");
      setFirebaseUser(fbUser);
      setCurrentUser(null);
      setUserPermissions([]);
      setLicenseInfo(null);
      setEffectiveLicenseStatus('pending');
      setIsUserDataLoaded(false);
      setLoading(true);

      if (fbUser) {
        const userDocRef = doc(db, "users", fbUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as User;
          const tenantId = userData.tenantId;
          console.log(`AUTH_CONTEXT: User data from Firestore (UID: ${fbUser.uid}, TenantID: ${tenantId}):`, userData);
          setCurrentUser({ ...userData, id: fbUser.uid });

          if (userData.role) {
            const roleDocRef = doc(db, "roles", userData.role);
            const roleDocSnap = await getDoc(roleDocRef);
            if (roleDocSnap.exists()) {
              setUserPermissions(roleDocSnap.data()?.permissions || []);
            }
          }

          if (tenantId) {
            const licenseDocRef = doc(db, "tenants", tenantId, "license", "info");
            const usersQuery = query(collection(db, "users"), where("tenantId", "==", tenantId));
            
            try {
              const [licenseDocSnap, usersSnapshot] = await Promise.all([
                getDoc(licenseDocRef),
                getDocs(usersQuery),
              ]);

              const currentLicense = licenseDocSnap.exists() ? (licenseDocSnap.data() as StoredLicenseInfo) : null;
              const currentCount = usersSnapshot.size;
              setLicenseInfo(currentLicense);
              setUserCount(currentCount);
              setEffectiveLicenseStatus(calculateEffectiveLicenseStatus(currentLicense, currentCount));
              console.log(`AUTH_CONTEXT: Tenant ${tenantId} - License:`, currentLicense, `User Count: ${currentCount}`);

            } catch (error) {
              console.error(`Error fetching tenant data for ${tenantId}:`, error);
              setEffectiveLicenseStatus('not_configured');
            }
          } else {
             // Handle users without a tenantId (e.g., system admins on base domain)
             console.log("AUTH_CONTEXT: User has no tenantId. Treating as active license for base domain access.");
             setEffectiveLicenseStatus('active'); 
             setLicenseInfo(null);
             setUserCount(null);
          }
        } else {
          console.error(`AUTH_CONTEXT: User document not found for UID: ${fbUser.uid}`);
          toast({ title: "Error de Perfil", description: "No se encontró tu perfil de usuario en la base de datos.", variant: "destructive" });
        }
      }
      setIsUserDataLoaded(true);
      setLoading(false);
    });

    return () => {
      console.log("AUTH_CONTEXT: onAuthStateChanged cleanup.");
      unsubscribe();
    };
  }, [toast, calculateEffectiveLicenseStatus]);

  const login = async (email: string, pass: string): Promise<FirebaseUser | null> => {
    // isLoading is now set in the useEffect hook observing auth state
    try {
      const uc = await signInWithEmailAndPassword(auth, email, pass);
      console.log("AUTH_CONTEXT: Firebase Auth login successful.");
      return uc.user;
    } catch (e: any) {
      console.error("AUTH_CONTEXT: Firebase Auth login failed:", e);
      let errorMessage = "Ocurrió un error inesperado.";
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        errorMessage = "Correo electrónico o contraseña incorrectos.";
      }
      toast({ title: "Error de Inicio de Sesión", description: errorMessage, variant: "destructive" });
      throw e; // Re-throw to be caught in the component
    }
  };

  const signup = async (email: string, pass: string, name: string, targetRole: Role, admin?: User | null): Promise<FirebaseUser | null> => {
    setLoading(true);
    try {
      const uc = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(uc.user, { displayName: name });
      
      const tenantIdToAssign = admin?.tenantId || null;
      if (!tenantIdToAssign) {
        throw new Error("El administrador que crea el usuario no tiene un tenantId asignado.");
      }

      await setDoc(doc(db, "users", uc.user.uid), {
        id: uc.user.uid,
        email: uc.user.email!,
        name,
        tenantId: tenantIdToAssign,
        role: targetRole.id,
        createdAt: new Date().toISOString()
      });
      toast({ title: "Usuario Registrado" });
      setLoading(false);
      return uc.user;
    } catch (e:any) {
      let m="Error";
      if(e.code === 'auth/email-already-in-use') m = "Correo ya en uso.";
      else if(e.code === 'auth/weak-password') m = "Contraseña débil.";
      else m = e.message;
      toast({ title: "Error Registro", description:m, variant:"destructive" });
      setLoading(false);
      throw e;
    }
  };

  const logout = async () => {
    console.log("AUTH_CONTEXT: logout.");
    await firebaseSignOut(auth);
  };
  
  const hasPermission = useCallback((p: string): boolean => {
    if (userPermissions.includes('admin')) return true; // Super-admin override
    return userPermissions.includes(p);
  }, [userPermissions]);

  const getAllUsers = useCallback(async (): Promise<User[]> => {
    if (!currentUser?.tenantId) return [];
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("tenantId", "==", currentUser.tenantId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as User));
    } catch (error) {
        console.error("Error fetching all users for tenant:", error);
        toast({ title: "Error", description: "No se pudieron cargar los usuarios de la organización.", variant: "destructive"});
        return [];
    }
  }, [currentUser, toast]);

  const updateUserInFirestore = async (userId: string, data: Partial<User>, adminUser: User | null) => {
    if (!adminUser || !adminUser.tenantId) throw new Error("Acción no permitida: Administrador sin tenantId.");
    const userToUpdateRef = doc(db, 'users', userId);
    const userToUpdateSnap = await getDoc(userToUpdateRef);
    if (!userToUpdateSnap.exists() || userToUpdateSnap.data().tenantId !== adminUser.tenantId) {
        throw new Error("No puedes editar usuarios de otra organización.");
    }
    await setDoc(userToUpdateRef, data, { merge: true });
  };


  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, isUserDataLoaded, userPermissions, licenseInfo, effectiveLicenseStatus, userCount, login, signup, logout, hasPermission, unreadInboxCount, isLoadingUnreadCount, getAllUsers, updateUserInFirestore }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within a AuthProvider');
  return ctx;
};
export const useAuthUnsafe = (): AuthContextType | undefined => useContext(AuthContext);
