import { getDb } from '@/app/lib/firebase';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';

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
    let body = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    } else {
      // Fallback parsers
      try {
        body = await req.json();
      } catch {
        try {
          const formData = await req.formData();
          for (const [key, value] of formData.entries()) {
            body[key] = value;
          }
        } catch {
          body = {};
        }
      }
    }

    // Determine if it is a Web3Forms webhook or a direct form submission
    let formId = "";
    let formName = "";
    let data = {};
    let ipAddress = "";
    let submitterEmail = "";
    let submitterName = "";
    let isDirectSubmission = false;

    if (body.form_id && body.data) {
      // Web3Forms Webhook payload format
      formId = body.form_id;
      formName = body.form_name || "Web3Form Submission";
      data = body.data;
      ipAddress = body.ip_address || "";
      submitterEmail = data.email || data.email_id || data.Email || "";
      submitterName = data.name || data.fullName || data.Name || "";
    } else {
      // Direct form submission format (HTML contact form)
      isDirectSubmission = true;
      formId = body.access_key || "direct_submission";
      formName = body.form_name || body.subject || "Direct Form Contact";
      
      // Separate specific fields and leave the rest as form data
      const { access_key, subject, redirect, from_name, ...rest } = body;
      data = rest;
      
      submitterEmail = body.email || body.email_id || body.Email || "";
      submitterName = body.name || body.fullName || body.Name || "";
      ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    }

    // Save submission to Firestore
    try {
      let isDuplicate = false;
      if (submitterEmail && formId) {
        const q = query(
          collection(db, 'web3forms'),
          where('submitterEmail', '==', submitterEmail),
          where('formId', '==', formId)
        );
        const querySnapshot = await getDocs(q);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        isDuplicate = querySnapshot.docs.some(doc => {
          const docData = doc.data();
          const submittedAt = docData.submittedAt && typeof docData.submittedAt.toDate === 'function' 
            ? docData.submittedAt.toDate() 
            : (docData.submittedAt instanceof Date ? docData.submittedAt : null);
          return submittedAt && submittedAt >= fiveMinutesAgo && JSON.stringify(docData.data) === JSON.stringify(data);
        });
      }

      if (!isDuplicate) {
        await addDoc(collection(db, 'web3forms'), {
          formId,
          formName,
          submitterEmail,
          submitterName,
          data,
          status: "new",
          submittedAt: Timestamp.now(),
          ipAddress,
        });
      } else {
        console.log(`Deduplicated Web3Forms webhook submission for ${submitterEmail}`);
      }
    } catch (firestoreError) {
      console.error("Failed to save submission to Firestore:", firestoreError);
      // Do not block the request if database is down, so emails can still go through
    }

    // If it's a direct HTML form submission and has an access key, forward to Web3Forms
    if (isDirectSubmission && body.access_key) {
      console.log("Forwarding direct submission to Web3Forms...");
      try {
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(body)
        });
        
        const result = await response.json();
        return Response.json(result, { 
          status: response.status,
          headers: corsHeaders
        });
      } catch (forwardError) {
        console.error("Failed to forward submission to Web3Forms:", forwardError);
        return Response.json({ 
          success: false, 
          message: "Saved in dashboard, but failed to forward email notification.", 
          error: forwardError.message 
        }, { 
          status: 502,
          headers: corsHeaders
        });
      }
    }

    return Response.json({ success: true, message: "Submission captured successfully" }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error("Error in Web3Forms webhook endpoint:", error);
    return Response.json({ success: false, error: error.message }, { 
      status: 500,
      headers: corsHeaders
    });
  }
}
