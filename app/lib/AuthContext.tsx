"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
} from "firebase/auth";
import { getFirebaseAuth, getDb, doc, setDoc, getDoc, Timestamp, collection, query, where, getDocs, deleteDoc } from "./firebase";
import { TeamMember, UserRole } from "@/app/types";

interface AuthContextType {
  user: User | null;
  profile: TeamMember | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileState: (data: Partial<TeamMember>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = getFirebaseAuth();
  const db = getDb();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string, email?: string | null) => {
    try {
      let snap = await getDoc(doc(db, "users", uid));
      let data = snap.exists() ? snap.data() : null;
      let docId = snap.id;

      if (!data && email) {
        const q = query(collection(db, "users"), where("email", "==", email));
        const emailSnap = await getDocs(q);
        if (!emailSnap.empty) {
          data = emailSnap.docs[0].data();
          docId = emailSnap.docs[0].id;
        }
      }

      if (data) {
        let role = data.role as UserRole;
        if (!role) {
          role = "member";
        }
        const profileData = { id: docId, ...data, role } as TeamMember;
        setProfile(profileData);
        if (typeof window !== "undefined") {
          localStorage.setItem("stackscale_user_profile", JSON.stringify(profileData));
        }
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    // Load cached profile on client-side mount immediately to speed up transition
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stackscale_user_profile");
      if (saved) {
        try {
          setProfile(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse cached profile", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // If we already have a cached profile from mount, resolve loading instantly
        const cached = typeof window !== "undefined" ? localStorage.getItem("stackscale_user_profile") : null;
        if (cached) {
          setLoading(false);
          fetchProfile(u.uid, u.email); // Fetch updated profile in the background
        } else {
          await fetchProfile(u.uid, u.email);
          setLoading(false);
        }
      } else {
        setProfile(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("stackscale_user_profile");
        }
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const applyTheme = (themeName: string) => {
      if (themeName === "dark") {
        document.documentElement.classList.add("dark");
      } else if (themeName === "light") {
        document.documentElement.classList.remove("dark");
      } else {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (systemDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    if (profile?.preferences?.theme) {
      applyTheme(profile.preferences.theme);
    } else {
      applyTheme("light");
    }
  }, [profile]);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user.uid, cred.user.email);
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole = "member") => {
    let existingDoc: any = null;
    let existingDocId = "";

    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error("Only the administrator/owner can add new members. Please contact the owner to register your email.");
    }
    existingDoc = snap.docs[0].data();
    existingDocId = snap.docs[0].id;

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    
    const p: Omit<TeamMember, "id"> = {
      name: name || existingDoc?.name || "Team Member",
      email,
      role: existingDoc?.role || "member",
      department: existingDoc?.department || "General",
      position: existingDoc?.position || "Team Member",
      skills: existingDoc?.skills || [],
      joinedAt: existingDoc?.joinedAt || Timestamp.now(),
      isActive: existingDoc?.isActive !== undefined ? existingDoc.isActive : true,
    };
    
    await setDoc(doc(db, "users", cred.user.uid), p);
    
    if (existingDocId) {
      try {
        await deleteDoc(doc(db, "users", existingDocId));
      } catch (e) {
        console.error("Failed to delete placeholder team member document", e);
      }
    }
    
    const profileData = { id: cred.user.uid, ...p };
    setProfile(profileData);
    if (typeof window !== "undefined") {
      localStorage.setItem("stackscale_user_profile", JSON.stringify(profileData));
    }
  };

  const logOut = async () => {
    await signOut(auth);
    setProfile(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("stackscale_user_profile");
    }
  };
  const resetPassword = async (email: string) => sendPasswordResetEmail(auth, email);
  const refreshProfile = async () => { if (user) await fetchProfile(user.uid, user.email); };

  const updateProfileState = (data: Partial<TeamMember>) => {
    setProfile((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      if (typeof window !== "undefined") {
        localStorage.setItem("stackscale_user_profile", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const isAdmin = profile?.role === "admin";
  const isMember = profile?.role === "member";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isMember, signIn, signUp, logOut, resetPassword, refreshProfile, updateProfileState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
