"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  db, collection, doc, addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, Timestamp,
  auth,
} from "./firebase";
import { QueryConstraint } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
  onAuthStateChanged(auth, (user) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const constraintsKey = getConstraintsCacheKey(constraints);
  const cacheKey = `${collectionName}:${constraintsKey}`;

  // Initialize state to empty/loading for SSR hydration compatibility
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Client-side cache check runs on mount to populate state immediately before repaint
    const cachedData = getCachedCollection(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let listener = activeCollectionListeners[cacheKey];

    const onDataUpdate = (newData: T[]) => {
      setData(newData);
      setLoading(false);
      setError(null);
    };

    const onErrorUpdate = (newError: string) => {
      setError(newError);
      setLoading(false);
    };

    if (!listener) {
      const ref = collection(db, collectionName);
      // Directly spread the original QueryConstraint objects to prevent corruption
      const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);

      const subscribers = new Set<(data: any[]) => void>();
      const errorSubscribers = new Set<(err: string) => void>();
      subscribers.add(onDataUpdate);

      const shared: SharedListener = {
        unsub: () => {},
        subscribers,
        errorSubscribers,
        data: cachedData || [],
        loading: !cachedData,
        error: null,
      };

      activeCollectionListeners[cacheKey] = shared;

      const unsubFirestore = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
          setCachedCollection(cacheKey, docs);
          shared.data = docs;
          shared.loading = false;
          shared.error = null;
          shared.subscribers.forEach((sub) => sub(docs));
        },
        (err) => {
          shared.loading = false;
          shared.error = err.message;
          shared.errorSubscribers.forEach((sub) => sub(err.message));
        }
      );

      shared.unsub = unsubFirestore;
    } else {
      listener.subscribers.add(onDataUpdate);
      listener.errorSubscribers.add(onErrorUpdate);

      onDataUpdate(listener.data);
      if (listener.error) {
        onErrorUpdate(listener.error);
      }
    }

    return () => {
      const activeListener = activeCollectionListeners[cacheKey];
      if (activeListener) {
        activeListener.subscribers.delete(onDataUpdate);
        activeListener.errorSubscribers.delete(onErrorUpdate);
      }
    };
  }, [collectionName, constraintsKey, cacheKey]);

  return { data, loading, error };
}

export function useDocument<T>(collectionName: string, docId: string | null) {
  const cacheKey = docId ? `${collectionName}:${docId}` : null;

  // Initialize state to empty/loading for SSR hydration compatibility
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId || !cacheKey) {
      setLoading(false);
      return;
    }

    const cachedData = getCachedDocument(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let listener = activeDocumentListeners[cacheKey];

    const onDataUpdate = (newData: T | null) => {
      setData(newData);
      setLoading(false);
      setError(null);
    };

    const onErrorUpdate = (newError: string) => {
      setError(newError);
      setLoading(false);
    };

    if (!listener) {
      const subscribers = new Set<(data: T | null) => void>();
      const errorSubscribers = new Set<(err: string) => void>();
      subscribers.add(onDataUpdate);

      const shared: SharedListener = {
        unsub: () => {},
        subscribers,
        errorSubscribers,
        data: cachedData || null,
        loading: !cachedData,
        error: null,
      };

      activeDocumentListeners[cacheKey] = shared;

      const unsubFirestore = onSnapshot(
        doc(db, collectionName, docId),
        (snap) => {
          const docData = snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
          setCachedDocument(cacheKey, docData);
          shared.data = docData;
          shared.loading = false;
          shared.error = null;
          shared.subscribers.forEach((sub) => sub(docData));
        },
        (err) => {
          shared.loading = false;
          shared.error = err.message;
          shared.errorSubscribers.forEach((sub) => sub(err.message));
        }
      );

      shared.unsub = unsubFirestore;
    } else {
      listener.subscribers.add(onDataUpdate);
      listener.errorSubscribers.add(onErrorUpdate);

      onDataUpdate(listener.data);
      if (listener.error) {
        onErrorUpdate(listener.error);
      }
    }

    return () => {
      const activeListener = activeDocumentListeners[cacheKey];
      if (activeListener) {
        activeListener.subscribers.delete(onDataUpdate);
        activeListener.errorSubscribers.delete(onErrorUpdate);
      }
    };
  }, [collectionName, docId, cacheKey]);

  return { data, loading, error };
}

export function useFirestore(collectionName: string) {
  const add = useCallback(
    async <T extends object>(data: T) => {
      const ref = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: Timestamp.now(),
      });
      return ref.id;
    },
    [collectionName]
  );

  const set = useCallback(
    async <T extends object>(id: string, data: T) =>
      setDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: Timestamp.now(),
      }),
    [collectionName]
  );

  const update = useCallback(
    async <T extends object>(id: string, data: Partial<T>) =>
      updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: Timestamp.now(),
      }),
    [collectionName]
  );

  const remove = useCallback(
    async (id: string) => deleteDoc(doc(db, collectionName, id)),
    [collectionName]
  );

  const get = useCallback(
    async <T>(id: string) => {
      const snap = await getDoc(doc(db, collectionName, id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
    },
    [collectionName]
  );

  const getAll = useCallback(
    async <T>(constraints: QueryConstraint[] = []) => {
      const ref = collection(db, collectionName);
      const q = constraints.length > 0 ? query(ref, ...constraints) : query(ref);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
    },
    [collectionName]
  );

  return { add, set, update, remove, get, getAll };
}

export function useDashboardStats() {
  const { data: projects, loading: lp } = useCollection<any>("projects");
  const { data: clients, loading: lc } = useCollection<any>("clients");
  const { data: responses, loading: lr } = useCollection<any>("responses");
  const { data: meetings, loading: lm } = useCollection<any>("meetings");
  const { data: users, loading: lu } = useCollection<any>("users");
  const { data: pipeline, loading: lpi } = useCollection<any>("pipeline");
  const { data: tasks, loading: lt } = useCollection<any>("tasks");

  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "in_progress").length;
    const completedProjects = projects.filter((p) => p.status === "completed").length;
    const pendingResponses = responses.filter((r) => r.status === "new").length;
    const upcomingMeetings = meetings.filter((m) => m.status === "scheduled").length;
    const tasksCompleted = tasks.filter((t) => t.status === "done").length;
    const tasksPending = tasks.filter((t) => t.status !== "done").length;
    const newLeads = pipeline.filter((d) => d.stage === "new").length;
    const totalRevenue = clients.reduce((sum, d) => sum + (d.totalValue || 0), 0);

    return {
      totalProjects: projects.length,
      activeProjects,
      completedProjects,
      totalClients: clients.length,
      pendingResponses,
      upcomingMeetings,
      teamMembers: users.length,
      pipelineLeads: pipeline.length,
      tasksCompleted,
      tasksPending,
      newLeads,
      totalRevenue,
    };
  }, [projects, clients, responses, meetings, users, pipeline, tasks]);

  const loading = lp || lc || lr || lm || lu || lpi || lt;

  return { stats, loading, refresh: () => {} };
}

export { where, orderBy, limit, Timestamp };