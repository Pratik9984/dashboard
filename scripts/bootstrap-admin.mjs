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
  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error("Error: Please provide an email address. Usage: node scripts/bootstrap-admin.mjs <email>");
    process.exit(1);
  }
  const email = emailArg.toLowerCase().trim();
  console.log(`Bootstrapping admin user for email: ${email}`);

  const usersRef = db.collection("users");
  
  // Check if there is already a user with this email
  const snap = await usersRef.where("email", "==", email).get();
  
  if (!snap.empty) {
    console.log(`User document already exists. Updating role to "admin" for ${snap.size} matching document(s).`);
    for (const doc of snap.docs) {
      await doc.ref.update({ role: "admin" });
      console.log(`Updated Doc ID: ${doc.id}`);
    }
  } else {
    console.log("Creating new placeholder user document with role: \"admin\"");
    const res = await usersRef.add({
      email: email,
      role: "admin",
      name: "Super Admin",
      department: "Executive",
      position: "Admin",
      skills: [],
      isActive: true,
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Created placeholder Doc ID: ${res.id}`);
  }
  console.log("Bootstrap complete. User can now sign up using this email to register as an Admin.");
}

run().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
