import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

const envPath = path.resolve(".env.local");
let firebaseConfig = {};

try {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  const configMap = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        configMap[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }

  firebaseConfig = {
    apiKey: configMap.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: configMap.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: configMap.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: configMap.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: configMap.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: configMap.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
} catch (err) {
  console.error("Error reading .env.local:", err.message);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkLeads() {
  console.log("Querying 'leads' collection...");
  try {
    const snap = await getDocs(collection(db, "leads"));
    console.log(`Found ${snap.size} lead documents.`);
    if (snap.size > 0) {
      for (let i = 0; i < Math.min(5, snap.size); i++) {
        const doc = snap.docs[i];
        console.log(`Lead ${i + 1} (ID: ${doc.id}):`, doc.data());
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

checkLeads();
