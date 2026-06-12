"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
} from "firebase/auth";
import { auth, db, doc, setDoc, getDoc, Timestamp } from "./firebase";
import { TeamMember, UserRole } from "@/app/types";

interface AuthContextType {
  user: User | null;
  profile: TeamMember | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() } as TeamMember);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await fetchProfile(u.uid);
      else setProfile(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user.uid);
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole = "member") => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const p: Omit<TeamMember, "id"> = {
      name, email, role,
      department: "General",
      position: "Team Member",
      skills: [],
      joinedAt: Timestamp.now(),
      isActive: true,
    };
    await setDoc(doc(db, "users", cred.user.uid), p);
    setProfile({ id: cred.user.uid, ...p });
  };

  const logOut = async () => { await signOut(auth); setProfile(null); };
  const resetPassword = async (email: string) => sendPasswordResetEmail(auth, email);
  const refreshProfile = async () => { if (user) await fetchProfile(user.uid); };
  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signUp, logOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
