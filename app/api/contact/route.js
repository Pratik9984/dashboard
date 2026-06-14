import { getDb } from '@/app/lib/firebase';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  const db = getDb();
  try {
    const { name, email, phone, message } = await req.json();

    if (!name || !email || !message) {
      return Response.json({ success: false, error: 'Name, email, and message are required' }, {
        status: 400,
        headers: corsHeaders
      });
    }

    // Deduplication check: look for submissions with same email and form ID, then filter by time in-memory to avoid index requirements
    const q = query(
      collection(db, 'web3forms'),
      where('submitterEmail', '==', email),
      where('formId', '==', 'stackandscale_contact')
    );
    
    const querySnapshot = await getDocs(q);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const duplicateDoc = querySnapshot.docs.find(doc => {
      const docData = doc.data();
      const submittedAt = docData.submittedAt && typeof docData.submittedAt.toDate === 'function' 
        ? docData.submittedAt.toDate() 
        : (docData.submittedAt instanceof Date ? docData.submittedAt : null);
      return submittedAt && submittedAt >= fiveMinutesAgo && docData.data?.message === message;
    });

    if (duplicateDoc) {
      return Response.json({
        success: true,
        id: duplicateDoc.id,
        emailSent: false,
        message: 'Submission captured successfully (deduplicated)'
      }, {
        headers: corsHeaders
      });
    }

    // 1. Save submission directly to Firestore under 'web3forms'
    const docRef = await addDoc(collection(db, 'web3forms'), {
      formId: 'stackandscale_contact',
      formName: 'Freelance Agency Website',
      submitterEmail: email,
      submitterName: name,
      data: {
        phone: phone || '',
        message: message
      },
      status: 'new',
      submittedAt: Timestamp.now(),
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || ""
    });

    // 2. Send email notification using Resend
    let emailSent = false;
    let emailError = null;

    if (resend) {
      try {
        const { error } = await resend.emails.send({
          from: process.env.GMAIL_USER,
          to: process.env.GMAIL_USER,
          subject: `New Lead: Project Scope Filed by ${name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 20px; font-size: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">New Web3Form Submission (Direct)</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 120px; font-size: 14px;">Name:</td>
                  <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #475569; font-size: 14px;">Email:</td>
                  <td style="padding: 8px 0; color: #0f172a; font-size: 14px;"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #475569; font-size: 14px;">Phone:</td>
                  <td style="padding: 8px 0; color: #0f172a; font-size: 14px;">${phone || '—'}</td>
                </tr>
              </table>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="font-weight: bold; color: #475569; margin-bottom: 8px; font-size: 14px;">Project Details / Message:</p>
                <p style="color: #334155; line-height: 1.6; white-space: pre-wrap; font-size: 14px; background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #f1f5f9; margin-top: 0;">${message}</p>
              </div>
              <div style="margin-top: 25px; text-align: center;">
                <a href="http://localhost:3000/web3-forms" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 8px; transition: background-color 0.2s;">View in Dashboard</a>
              </div>
            </div>
          `,
        });

        if (error) {
          console.error("Resend email notification failed:", error);
          emailError = error;
        } else {
          emailSent = true;
        }
      } catch (err) {
        console.error("Failed to send email notification via Resend:", err);
        emailError = err.message || err;
      }
    } else {
      console.warn("RESEND_API_KEY is not defined in environment variables. Skipped sending email notification.");
    }

    return Response.json({
      success: true,
      id: docRef.id,
      emailSent,
      emailError,
      message: 'Submission captured successfully'
    }, {
      headers: corsHeaders
    });

  } catch (err) {
    console.error("Error in contact API endpoint:", err);
    return Response.json({ success: false, error: err.message }, {
      status: 500,
      headers: corsHeaders
    });
  }
}
