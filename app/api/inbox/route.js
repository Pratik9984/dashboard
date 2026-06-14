import { getDb } from '@/app/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { requireAdmin } from '@/app/lib/firebaseAdmin';

export async function POST(req) {
  const db = getDb();
  let sender = "";
  let subject = "";
  let body = "";
  let html = "";
  let to = [process.env.GMAIL_USER || ''];
  let cc = [];
  let attachments = [];

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const data = await req.formData();
      sender = data.get('sender') || data.get('from') || '';
      subject = data.get('subject') || '';
      body = data.get('body-plain') || data.get('text') || data.get('body') || '';
      html = data.get('body-html') || data.get('html') || '';
      
      const toVal = data.get('to');
      if (toVal) to = toVal.split(',').map(e => e.trim()).filter(Boolean);
      const ccVal = data.get('cc');
      if (ccVal) cc = ccVal.split(',').map(e => e.trim()).filter(Boolean);

      // Extract files from formData and upload to storage
      const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { getFirebaseStorage } = await import('@/app/lib/firebase');
      const storage = getFirebaseStorage();

      for (const [key, value] of data.entries()) {
        if (value && typeof value === 'object' && typeof value.arrayBuffer === 'function') {
          const file = value;
          try {
            const filename = file.name || key;
            const mimeType = file.type || 'application/octet-stream';
            const size = file.size || 0;
            const buffer = Buffer.from(await file.arrayBuffer());

            const fileRef = storageRef(storage, `emails/attachments/${Date.now()}_${filename}`);
            const snapshot = await uploadBytes(fileRef, buffer, { contentType: mimeType });
            const url = await getDownloadURL(snapshot.ref);

            attachments.push({
              name: filename,
              url: url,
              size: size,
              type: mimeType
            });
          } catch (uploadError) {
            console.error("Failed to upload inbound attachment to Firebase Storage:", uploadError);
          }
        }
      }
    } else if (contentType.includes("application/json")) {
      const data = await req.json();
      sender = data.sender || data.from || '';
      subject = data.subject || '';
      body = data.body || data.text || '';
      html = data.html || '';
      
      if (data.to) to = Array.isArray(data.to) ? data.to : [data.to];
      if (data.cc) cc = Array.isArray(data.cc) ? data.cc : [data.cc];

      if (data.attachments && Array.isArray(data.attachments)) {
        const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const { getFirebaseStorage } = await import('@/app/lib/firebase');
        const storage = getFirebaseStorage();

        for (const att of data.attachments) {
          if (att.content && att.filename) {
            try {
              const buffer = Buffer.from(att.content, 'base64');
              const mimeType = att.type || att.contentType || 'application/octet-stream';
              const fileRef = storageRef(storage, `emails/attachments/${Date.now()}_${att.filename}`);
              const snapshot = await uploadBytes(fileRef, buffer, { contentType: mimeType });
              const url = await getDownloadURL(snapshot.ref);

              attachments.push({
                name: att.filename,
                url: url,
                size: buffer.length,
                type: mimeType
              });
            } catch (jsonAttachError) {
              console.error("Failed to process JSON base64 attachment:", jsonAttachError);
            }
          } else if (att.url && att.filename) {
            try {
              const fileRes = await fetch(att.url);
              if (fileRes.ok) {
                const buffer = Buffer.from(await fileRes.arrayBuffer());
                const mimeType = att.type || att.contentType || fileRes.headers.get('content-type') || 'application/octet-stream';
                const fileRef = storageRef(storage, `emails/attachments/${Date.now()}_${att.filename}`);
                const snapshot = await uploadBytes(fileRef, buffer, { contentType: mimeType });
                const url = await getDownloadURL(snapshot.ref);

                attachments.push({
                  name: att.filename,
                  url: url,
                  size: buffer.length,
                  type: mimeType
                });
              }
            } catch (jsonAttachUrlError) {
              console.error("Failed to fetch and process JSON attachment url:", jsonAttachUrlError);
            }
          }
        }
      }
    }

    // Deduplication check: check if an email with the same from and subject was received in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const q = query(
      collection(db, 'emails'),
      where('from', '==', sender || 'anonymous@sender.com'),
      where('subject', '==', subject || '(No subject)'),
      where('createdAt', '>=', Timestamp.fromDate(fiveMinutesAgo))
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Save submission to Firestore
      await addDoc(collection(db, 'emails'), {
        from: sender || 'anonymous@sender.com',
        to: to,
        cc: cc,
        subject: subject || '(No subject)',
        body: body || '',
        html: html || '',
        attachments: attachments,
        status: 'received',
        tags: ['inbox'],
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        read: false,
        starred: false,
      });
    } else {
      console.log(`Deduplicated direct inbound email POST from ${sender || 'anonymous@sender.com'} with subject ${subject || '(No subject)'}`);
    }

    return Response.json({ ok: true });
  } catch (firestoreError) {
    console.error("Firestore database error in inbox POST:", firestoreError);
    return Response.json({ 
      ok: false, 
      error: firestoreError.message 
    }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 401 });
  }
  const db = getDb();
  const username = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') : '';

  if (!username || !password) {
    console.warn("GMAIL_USER or GMAIL_APP_PASSWORD is not defined in environment variables. Returning cached emails.");
    try {
      const q = query(collection(db, 'emails'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const emails = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : data.date
        };
      });
      return Response.json(emails);
    } catch (err) {
      console.error("Error fetching inbox GET:", err);
      return Response.json([], { status: 500 });
    }
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: username,
      pass: password,
    },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });

  client.on('error', (err) => {
    console.error('Unhandled IMAP client error:', err);
  });

  const syncPromise = async () => {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const count = client.mailbox.exists;
      if (count > 0) {
        const startRange = Math.max(1, count - 19);
        const range = `${startRange}:${count}`;

        for await (let message of client.fetch(range, { envelope: true, uid: true, source: true })) {
          const messageId = message.envelope.messageId || `no-id-${message.envelope.date.getTime()}-${Math.random()}`;
          
          const emailsRef = collection(db, 'emails');
          const qExist = query(emailsRef, where('messageId', '==', messageId));
          const existSnapshot = await getDocs(qExist);

          if (existSnapshot.empty) {
            if (message.source) {
              const parsed = await simpleParser(message.source);
              
              const uploadedAttachments = [];
              if (parsed.attachments && parsed.attachments.length > 0) {
                const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
                const { getFirebaseStorage } = await import('@/app/lib/firebase');
                const storage = getFirebaseStorage();

                for (const att of parsed.attachments) {
                  try {
                    const filename = att.filename || `attachment-${Date.now()}`;
                    const mimeType = att.contentType || 'application/octet-stream';
                    const size = att.size || att.content.length;
                    
                    const fileRef = storageRef(storage, `emails/attachments/${Date.now()}_${filename}`);
                    const snapshot = await uploadBytes(fileRef, new Uint8Array(att.content), { contentType: mimeType });
                    const url = await getDownloadURL(snapshot.ref);

                    uploadedAttachments.push({
                      name: filename,
                      url: url,
                      size: size,
                      type: mimeType
                    });
                  } catch (attError) {
                    console.error("Failed to upload attachment from IMAP:", attError);
                  }
                }
              }

              const formatAddress = (addr) => {
                if (!addr) return '';
                if (addr.name) return `${addr.name} <${addr.address}>`;
                return addr.address;
              };

              const fromVal = parsed.from && parsed.from.value && parsed.from.value.length > 0
                ? formatAddress(parsed.from.value[0])
                : (message.envelope.from && message.envelope.from.length > 0
                    ? formatAddress(message.envelope.from[0])
                    : 'unknown@sender.com');

              const toArray = parsed.to && parsed.to.value
                ? parsed.to.value.map(formatAddress)
                : (message.envelope.to ? message.envelope.to.map(formatAddress) : []);

              const ccArray = parsed.cc && parsed.cc.value
                ? parsed.cc.value.map(formatAddress)
                : (message.envelope.cc ? message.envelope.cc.map(formatAddress) : []);

              await addDoc(collection(db, 'emails'), {
                from: fromVal,
                to: toArray,
                cc: ccArray,
                subject: parsed.subject || message.envelope.subject || '(No subject)',
                body: parsed.text || '',
                html: parsed.html || parsed.textAsHtml || '',
                attachments: uploadedAttachments,
                status: 'received',
                tags: ['inbox'],
                date: Timestamp.fromDate(parsed.date || message.envelope.date || new Date()),
                createdAt: Timestamp.now(),
                read: false,
                starred: false,
                messageId: messageId,
              });
            }
          }
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  };

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Sync process timed out after 25 seconds (possibly due to Firestore or network connection failure)")), 25000)
  );

  try {
    await Promise.race([syncPromise(), timeoutPromise]);
  } catch (imapError) {
    console.error("Error connecting or syncing via IMAP:", imapError);
    try {
      await client.logout();
    } catch {}
    return Response.json({
      error: `Failed to sync IMAP emails: ${imapError.message || imapError}`
    }, { status: 500 });
  }

  try {
    const q = query(collection(db, 'emails'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const emails = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date && typeof data.date.toDate === 'function' ? data.date.toDate() : data.date
      };
    });
    return Response.json(emails);
  } catch (err) {
    console.error("Error fetching inbox from database after sync attempt:", err);
    return Response.json([], { status: 500 });
  }
}
