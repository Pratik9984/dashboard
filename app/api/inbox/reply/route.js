import { getDb } from '@/app/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { Resend } from 'resend';
import { requireAdmin } from '@/app/lib/firebaseAdmin';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 401 });
  }

  const db = getDb();
  try {
    const { to, cc, subject, body, html, attachments, threadId } = await req.json();

    const recipientList = Array.isArray(to) ? to : [to];
    const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : [];

    const resendAttachments = [];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        try {
          const fileRes = await fetch(att.url);
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            resendAttachments.push({
              filename: att.name,
              content: buffer,
            });
          } else {
            console.warn(`Failed to fetch attachment from URL: ${att.url}`);
          }
        } catch (err) {
          console.error(`Error downloading attachment ${att.name}:`, err);
        }
      }
    }

    let sendSuccess = true;
    let mocked = false;

    if (!resend) {
      console.warn("RESEND_API_KEY is not defined in environment variables. Simulating email send.");
      mocked = true;
    } else {
      const sendParams = {
        from: process.env.GMAIL_USER,
        to: recipientList,
        subject: subject,
        html: html || body || '(No content)',
        attachments: resendAttachments,
      };

      if (ccList.length > 0) {
        sendParams.cc = ccList;
      }

      const { error } = await resend.emails.send(sendParams);

      if (error) {
        console.error("Resend send email error:", error);
        sendSuccess = false;
        return Response.json({ error }, { status: 500 });
      }
    }

    // Save successfully sent/mocked email to Firestore
    const savedDoc = await addDoc(collection(db, 'emails'), {
      from: process.env.GMAIL_USER,
      to: recipientList,
      cc: ccList,
      subject: subject || '(No subject)',
      body: body || '',
      html: html || body || '',
      attachments: attachments || [],
      status: sendSuccess ? 'sent' : 'failed',
      tags: sendSuccess ? ['sent'] : ['failed'],
      date: Timestamp.now(),
      createdAt: Timestamp.now(),
      read: true,
      starred: false,
      threadId: threadId || null,
    });

    return Response.json({ ok: true, id: savedDoc.id, mocked });
  } catch (err) {
    console.error("Error in inbox reply POST handler:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
