"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDb, getFirebaseAuth, collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, Timestamp,
} from "./firebase";
import { QueryConstraint } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "./AuthContext";

// Global in-memory cache for Firestore collection queries, documents, and dashboard stats
const collectionCache: Record<string, any> = {};
const documentCache: Record<string, any> = {};
let statsCache: any = null;

const COLLECTION_CACHE_KEY_PREFIX = "stackscale_col_";
const DOCUMENT_CACHE_KEY_PREFIX = "stackscale_doc_";
const STATS_CACHE_KEY = "stackscale_stats";

// Helper to load collection cache from localStorage
function getCachedCollection(key: string): any[] | null {
  if (typeof window === "undefined") return null;
  if (collectionCache[key]) return collectionCache[key];
  try {
    const val = localStorage.getItem(COLLECTION_CACHE_KEY_PREFIX + key);
    if (val) {
      const parsed = JSON.parse(val);
      collectionCache[key] = parsed;
      return parsed;
    }
  } catch (e) {
    console.error("Error reading from localStorage:", e);
  }
  return null;
}

// Helper to save collection cache to localStorage
function setCachedCollection(key: string, data: any[]) {
  collectionCache[key] = data;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLLECTION_CACHE_KEY_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.error("Error writing to localStorage:", e);
  }
}

// Helper to load document cache from localStorage
function getCachedDocument(key: string): any | null {
  if (typeof window === "undefined") return null;
  if (documentCache[key]) return documentCache[key];
  try {
    const val = localStorage.getItem(DOCUMENT_CACHE_KEY_PREFIX + key);
    if (val) {
      const parsed = JSON.parse(val);
      documentCache[key] = parsed;
      return parsed;
    }
  } catch (e) {
    console.error("Error reading from localStorage:", e);
  }
  return null;
}

// Helper to save document cache to localStorage
function setCachedDocument(key: string, data: any) {
  documentCache[key] = data;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOCUMENT_CACHE_KEY_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.error("Error writing to localStorage:", e);
  }
}

interface SharedListener {
  unsub: () => void;
  subscribers: Set<(data: any) => void>;
  errorSubscribers: Set<(err: string) => void>;
  data: any;
  loading: boolean;
  error: string | null;
}

const activeCollectionListeners: Record<string, SharedListener> = {};
const activeDocumentListeners: Record<string, SharedListener> = {};

// Clean up listeners and localStorage cache on logout
if (typeof window !== "undefined") {
  onAuthStateChanged(getFirebaseAuth(), (user) => {
    if (!user) {
      Object.keys(activeCollectionListeners).forEach((key) => {
        try {
          activeCollectionListeners[key].unsub();
        } catch (e) {
          console.error("Error cleaning up collection listener:", e);
        }
        delete activeCollectionListeners[key];
      });

      Object.keys(activeDocumentListeners).forEach((key) => {
        try {
          activeDocumentListeners[key].unsub();
        } catch (e) {
          console.error("Error cleaning up document listener:", e);
        }
        delete activeDocumentListeners[key];
      });

      statsCache = null;
      Object.keys(collectionCache).forEach((key) => delete collectionCache[key]);
      Object.keys(documentCache).forEach((key) => delete documentCache[key]);

      // Remove localStorage keys prefixed with our namespace
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith(COLLECTION_CACHE_KEY_PREFIX) || 
            key.startsWith(DOCUMENT_CACHE_KEY_PREFIX) || 
            key === STATS_CACHE_KEY
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
    }
  });
}

function getConstraintsCacheKey(constraints: QueryConstraint[]): string {
  if (!constraints || constraints.length === 0) return "";
  try {
    return constraints.map((c: any) => {
      const keys = Object.keys(c).sort();
      const serializedFields: Record<string, any> = { type: c.type || "unknown" };
      for (const k of keys) {
        if (typeof c[k] !== "function" && k !== "type" && !k.startsWith("_")) {
          serializedFields[k] = c[k];
        }
      }
      if (c._field) serializedFields.field = c._field.segments?.join(".") || String(c._field);
      if (c._op) serializedFields.op = c._op;
      if (c._value !== undefined) serializedFields.value = c._value;
      if (c._direction) serializedFields.direction = c._direction;
      if (c._limit) serializedFields.limit = c._limit;
      
      return JSON.stringify(serializedFields);
    }).join("|");
  } catch (e) {
    console.error("Error serializing constraints:", e);
    return "error-fallback";
  }
}

export function useCollection<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const { user } = useAuth();
  const userId = user?.uid || "";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const constraintsKey = getConstraintsCacheKey(constraints);
  const cacheKey = `${collectionName}:${constraintsKey}:${userId}`;

  // Initialize state to empty/loading for SSR hydration compatibility
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const ref = collection(getDb(), collectionName);
      // Directly spread the original QueryConstraint objects to prevent corruption
      const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
      
      setCachedCollection(cacheKey, docs);
      setData(docs);
      setError(null);
    } catch (err: any) {
      console.error(`Error loading collection ${collectionName}:`, err);
      setError(err.message || "Failed to load collection");
    } finally {
      setLoading(false);
    }
  }, [collectionName, constraintsKey, cacheKey]);

  useEffect(() => {
    // Client-side cache check runs on mount to populate state immediately before repaint
    const cachedData = getCachedCollection(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      // Trigger background update (AJAX sync)
      fetchData(false);
    } else {
      fetchData(true);
    }
  }, [cacheKey, fetchData]);

  return { data, loading, error, refresh: () => fetchData(true) };
}

export function useDocument<T>(collectionName: string, docId: string | null) {
  const { user } = useAuth();
  const userId = user?.uid || "";
  const cacheKey = docId ? `${collectionName}:${docId}:${userId}` : null;

  // Initialize state to empty/loading for SSR hydration compatibility
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoc = useCallback(async (showLoading = true) => {
    if (!docId || !cacheKey) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const snap = await getDoc(doc(getDb(), collectionName, docId));
      const docData = snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
      
      setCachedDocument(cacheKey, docData);
      setData(docData);
      setError(null);
    } catch (err: any) {
      console.error(`Error loading document ${collectionName}/${docId}:`, err);
      setError(err.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [collectionName, docId, cacheKey]);

  useEffect(() => {
    if (!docId || !cacheKey) {
      setLoading(false);
      return;
    }

    const cachedData = getCachedDocument(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      // Trigger background update (AJAX sync)
      fetchDoc(false);
    } else {
      fetchDoc(true);
    }
  }, [docId, cacheKey, fetchDoc]);

  return { data, loading, error, refresh: () => fetchDoc(true) };
}

export function useFirestore(collectionName: string) {
  const add = useCallback(
    async <T extends object>(data: T) => {
      const ref = await addDoc(collection(getDb(), collectionName), {
        ...data,
        createdAt: Timestamp.now(),
      });
      return ref.id;
    },
    [collectionName]
  );

  const set = useCallback(
    async <T extends object>(id: string, data: T) =>
      setDoc(doc(getDb(), collectionName, id), {
        ...data,
        updatedAt: Timestamp.now(),
      }),
    [collectionName]
  );

  const update = useCallback(
    async <T extends object>(id: string, data: Partial<T>) =>
      updateDoc(doc(getDb(), collectionName, id), {
        ...data,
        updatedAt: Timestamp.now(),
      }),
    [collectionName]
  );

  const remove = useCallback(
    async (id: string) => deleteDoc(doc(getDb(), collectionName, id)),
    [collectionName]
  );

  const get = useCallback(
    async <T>(id: string) => {
      const snap = await getDoc(doc(getDb(), collectionName, id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
    },
    [collectionName]
  );

  const getAll = useCallback(
    async <T>(constraints: QueryConstraint[] = []) => {
      const ref = collection(getDb(), collectionName);
      const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
    },
    [collectionName]
  );

  return { add, set, update, remove, get, getAll };
}

export function useDashboardStats() {
  const { profile, isAdmin, isManager } = useAuth();
  const currentUserId = profile?.id || "";
  const currentUserName = profile?.name || "";

  const { data: projects, loading: lp } = useCollection<any>("projects");
  const { data: clients, loading: lc } = useCollection<any>("clients");
  const { data: responses, loading: lr } = useCollection<any>("responses");
  const { data: meetings, loading: lm } = useCollection<any>("meetings");
  const { data: users, loading: lu } = useCollection<any>("users");
  const { data: leads, loading: lpi } = useCollection<any>("leads");
  const { data: tasks, loading: lt } = useCollection<any>("tasks");
  const { data: sheets, loading: lsh } = useCollection<any>("sheets");

  const stats = useMemo(() => {
    // If not admin/owner/manager, filter data down to user's assigned scope
    const isRestricted = !isAdmin && !isManager;

    const filteredProjects = isRestricted
      ? projects.filter((p) => p.assignees?.includes(currentUserId) || p.createdBy === currentUserId)
      : projects;

    const assignedClientNames = new Set(
      filteredProjects.map((p) => p.clientName?.toLowerCase().trim())
    );

    const filteredClients = isRestricted
      ? clients.filter((c) => c.createdBy === currentUserId || assignedClientNames.has(c.name?.toLowerCase().trim()) || assignedClientNames.has(c.company?.toLowerCase().trim()))
      : clients;

    const filteredTasks = isRestricted
      ? tasks.filter((t) => t.assignedTo === currentUserId || t.assigneeName?.toLowerCase() === currentUserName.toLowerCase() || t.createdBy === currentUserId)
      : tasks;

    const filteredMeetings = isRestricted
      ? meetings.filter((m) => m.createdBy === currentUserId || m.attendees?.includes(currentUserId) || m.attendeeNames?.some((name: string) => name.toLowerCase() === currentUserName.toLowerCase()))
      : meetings;

    const myAssignedSheetIds = new Set(
      sheets
        .filter((s: any) => s.assignedTo === currentUserId || s.createdBy === currentUserId)
        .map((s: any) => s.id)
    );

    const filteredLeads = isRestricted
      ? leads.filter((l) => l.sheetId && myAssignedSheetIds.has(l.sheetId))
      : leads;

    const filteredResponses = isRestricted
      ? responses.filter((r) => r.assignedTo === currentUserId || r.assignedTo === currentUserName)
      : responses;

    const activeProjects = filteredProjects.filter((p) => p.status === "in_progress").length;
    const completedProjects = filteredProjects.filter((p) => p.status === "completed").length;
    const pendingResponses = filteredResponses.filter((r) => r.status === "new").length;
    const totalResponses = filteredResponses.length;
    const repliedResponses = filteredResponses.filter((r) => r.status === "replied").length;
    const upcomingMeetings = filteredMeetings.filter((m) => m.status === "scheduled").length;
    const tasksCompleted = filteredTasks.filter((t) => t.status === "done").length;
    const tasksPending = filteredTasks.filter((t) => t.status !== "done").length;
    const newLeads = filteredLeads.filter((d) => d.stage === "new").length;
    const totalRevenue = filteredClients.reduce((sum, d) => sum + (d.totalValue || 0), 0);

    return {
      totalProjects: filteredProjects.length,
      activeProjects,
      completedProjects,
      totalClients: filteredClients.length,
      pendingResponses,
      totalResponses,
      repliedResponses,
      upcomingMeetings,
      teamMembers: users.length,
      pipelineLeads: filteredLeads.length,
      tasksCompleted,
      tasksPending,
      newLeads,
      totalRevenue,
    };
  }, [projects, clients, responses, meetings, users, leads, tasks, sheets, isAdmin, isManager, currentUserId, currentUserName]);

  const loading = lp || lc || lr || lm || lu || lpi || lt || lsh;

  return { stats, loading, refresh: () => {} };
}

export { where, orderBy, limit, Timestamp };