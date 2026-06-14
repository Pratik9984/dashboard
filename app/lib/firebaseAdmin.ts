import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

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

export const adminDb = getFirestore();
export const adminAuth = getAuth();

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or invalid token format");
  }
  const token = authHeader.substring(7);
  const decodedToken = await adminAuth.verifyIdToken(token);
  const uid = decodedToken.uid;

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new Error("Unauthorized: User profile not found");
  }
  const userData = userDoc.data();
  if (userData?.role !== "admin") {
    throw new Error("Unauthorized: Admin role required");
  }
  return { uid, email: decodedToken.email || null };
}
