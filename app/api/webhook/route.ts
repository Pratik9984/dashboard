import { NextRequest } from "next/server";
import { getDb, getFirebaseStorage } from "@/app/lib/firebase";

import { collection, addDoc, Timestamp, query, where, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

export const POST = async (req: NextRequest) => {
  const db = getDb();
  const storage = getFirebaseStorage();
  try {
    const event = await req.json();

    if (event.type === "email.received") {
      const data = event.data;
      
      const from = data.from || "";
      const to = data.to || [];
      const cc = data.cc || [];
      const subject = data.subject || "(No subject)";
      const body = data.text || "";
      const html = data.html || "";
      
      const attachments: { name: string; url: string; size: number; type: string }[] = [];

      // Process attachments by downloading from Resend and uploading permanently to Firebase Storage
      if (data.attachments && Array.isArray(data.attachments)) {
        for (const att of data.attachments) {
          if (att.url && att.name) {
            try {
              const fileRes = await fetch(att.url);
              if (fileRes.ok) {
                const arrayBuffer = await fileRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const mimeType = att.contentType || fileRes.headers.get("content-type") || "application/octet-stream";
                const size = att.size || buffer.length;

                // Save permanently in the Firebase storage bucket
                const fileReference = storageRef(storage, `emails/attachments/${Date.now()}_${att.name}`);
                const snapshot = await uploadBytes(fileReference, buffer, { contentType: mimeType });
                const publicUrl = await getDownloadURL(snapshot.ref);

                attachments.push({
                  name: att.name,
                  url: publicUrl,
                  size: size,
                  type: mimeType
                });
              }
            } catch (err) {
              console.error(`Error processing attachment ${att.name} in webhook:`, err);
            }
          }
        }
      }

      // Deduplication check: check if an email with the same from and subject was received in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const q = query(
        collection(db, "emails"),
        where("from", "==", from),
        where("subject", "==", subject),
        where("createdAt", ">=", Timestamp.fromDate(fiveMinutesAgo))
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Add to Firestore emails collection
        await addDoc(collection(db, "emails"), {
          from,
          to,
          cc,
          subject,
          body,
          html,
          attachments,
          status: "received",
          tags: ["inbox"],
          date: Timestamp.now(),
          createdAt: Timestamp.now(),
          read: false,
          starred: false
        });
      } else {
        console.log(`Deduplicated inbound Resend webhook email from ${from} with subject ${subject}`);
      }

      return Response.json({ ok: true });
    }

    return Response.json({ ok: true, ignored: true });
  } catch (error: any) {
    console.error("Inbound webhook parsing error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
};
