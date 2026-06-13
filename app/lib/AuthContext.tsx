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
  isOwner: boolean;
  isManager: boolean;
  isMember: boolean;
  isViewer: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: UserRole) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = getFirebaseAuth();
  const db = getDb();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        let role = data.role as UserRole;
        if (data.email?.toLowerCase() === "hello@stackandscale.in") {
          role = "owner";
        }
        const profileData = { id: snap.id, ...data, role } as TeamMember;
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
          fetchProfile(u.uid); // Fetch updated profile in the background
        } else {
          await fetchProfile(u.uid);
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

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(cred.user.uid);
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole = "member") => {
    const isOwnerSetup = email.toLowerCase() === "hello@stackandscale.in";
    let existingDoc: any = null;
    let existingDocId = "";

    if (!isOwnerSetup) {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error("Only the administrator/owner can add new members. Please contact the owner to register your email.");
      }
      existingDoc = snap.docs[0].data();
      existingDocId = snap.docs[0].id;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    
    const p: Omit<TeamMember, "id"> = {
      name: name || existingDoc?.name || "Team Member",
      email,
      role: isOwnerSetup ? "owner" : (existingDoc?.role || "member"),
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
  const refreshProfile = async () => { if (user) await fetchProfile(user.uid); };

  const isOwner = profile?.role === "owner";
  const isAdmin = profile?.role === "owner" || profile?.role === "admin";
  const isManager = profile?.role === "manager";
  const isMember = profile?.role === "member";
  const isViewer = profile?.role === "viewer";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isOwner, isManager, isMember, isViewer, signIn, signUp, logOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
