import fs from "fs";
import path from "path";
import admin from "firebase-admin";

// Load env vars from .env.local
const envPath = path.resolve(".env.local");
const configMap = {};
try {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        let key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        configMap[key] = val;
      }
    }
  }
} catch (err) {
  console.log("Could not read .env.local, falling back to process.env");
}

Object.assign(process.env, configMap);

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  if (privateKey && clientEmail && projectId) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  } else if (projectId) {
    admin.initializeApp({ projectId });
  } else {
    console.error("Missing Firebase SDK environment variables.");
    process.exit(1);
  }
}

const db = admin.firestore();

async function run() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "=== RUNNING ROLE MIGRATION (APPLY MODE) ===" : "=== RUNNING ROLE MIGRATION (DRY-RUN MODE) ===");
  
  const usersRef = db.collection("users");
  const snap = await usersRef.get();
  
  console.log(`Found ${snap.size} total users.`);
  let totalMigrated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const currentRole = data.role;
    let targetRole = "member";

    if (["owner", "admin", "manager"].includes(currentRole)) {
      targetRole = "admin";
    } else {
      targetRole = "member";
    }

    if (currentRole !== targetRole) {
      console.log(`User ID: ${doc.id} | Email: ${data.email || "N/A"} | Name: ${data.name || "N/A"} | Role: "${currentRole}" -> "${targetRole}"`);
      totalMigrated++;
      if (apply) {
        await doc.ref.update({ role: targetRole });
      }
    }
  }

  console.log(`\nMigration completed.`);
  console.log(`Modified: ${totalMigrated} users.`);
  if (!apply && totalMigrated > 0) {
    console.log(`This was a dry run. To persist changes in database, run with: node scripts/migrate-roles.mjs --apply`);
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
