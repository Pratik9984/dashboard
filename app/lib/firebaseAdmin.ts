import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;
let isInitialized = false;

function initFirebaseAdmin() {
  if (isInitialized) return;
  
  if (!getApps().length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (privateKey && clientEmail && projectId) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      initializeApp();
    }
  }

  adminDb = getFirestore();
  adminAuth = getAuth();
  isInitialized = true;
}

export async function requireAdmin(req: Request) {
  initFirebaseAdmin();
  
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or invalid token format");
  }
  const token = authHeader.substring(7);
  const decodedToken = await adminAuth!.verifyIdToken(token);
  const uid = decodedToken.uid;

  const userDoc = await adminDb!.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new Error("Unauthorized: User profile not found");
  }
  const userData = userDoc.data();
  if (userData?.role !== "admin") {
    throw new Error("Unauthorized: Admin role required");
  }
  return { uid, email: decodedToken.email || null };
}
