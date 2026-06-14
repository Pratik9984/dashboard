import { Resend } from 'resend';
import { requireAdmin } from '@/app/lib/firebaseAdmin';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 401 });
  }

  const { to, subject, body, html, attachments } = await req.json();

  if (!resend) {
    console.warn("RESEND_API_KEY is not defined in environment variables. Simulating email send.");
    return Response.json({ ok: true, mocked: true });
  }

  // Download files to attach them as Buffers for Resend
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

  const { error } = await resend.emails.send({
    from: process.env.GMAIL_USER,
    to,
    subject,
    html: html || body || '(No content)',
    attachments: resendAttachments,
  });

  if (error) {
    console.error("Resend send email error:", error);
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
