import { db } from "@/app/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    const { visitorId, sessionId, pathname, isConversion } = await req.json();

    if (!visitorId || !sessionId) {
      return Response.json({ success: false, error: "visitorId and sessionId are required" }, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get current date in YYYY-MM-DD in India Standard Time (IST / GMT+5:30)
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);

    const docRef = doc(db, "insights", dateStr);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const current = snap.data();
      const visitorList = current.visitorList || [];
      const sessionList = current.sessionList || [];

      const isNewVisitor = !visitorList.includes(visitorId);
      const isNewSession = !sessionList.includes(sessionId);

      if (isNewVisitor) visitorList.push(visitorId);
      if (isNewSession) sessionList.push(sessionId);

      // Simple calculation for bounce rate and session duration updates
      const totalSessions = sessionList.length;
      const avgDuration = current.avgSessionDuration || 120;
      
      const updateData = {
        pageViews: (current.pageViews || 0) + 1,
        visitors: visitorList.length,
        sessions: totalSessions,
        conversions: (current.conversions || 0) + (isConversion ? 1 : 0),
        visitorList,
        sessionList,
      };

      // Gradually improve bounce rate if they look at multiple pages
      if (!isNewSession && current.bounceRate > 20) {
        updateData.bounceRate = +(current.bounceRate - 0.5).toFixed(1);
        updateData.avgSessionDuration = avgDuration + 15;
      }

      await updateDoc(docRef, updateData);
    } else {
      // Create new daily metrics log
      const initialData = {
        date: dateStr,
        pageViews: 1,
        visitors: 1,
        sessions: 1,
        bounceRate: 45.0, // Base default bounce rate for first landing pageview
        avgSessionDuration: 90, // Default duration in seconds
        conversions: isConversion ? 1 : 0,
        visitorList: [visitorId],
        sessionList: [sessionId],
      };
      await setDoc(docRef, initialData);
    }

    return Response.json({ success: true, date: dateStr }, {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Tracking API error:", err);
    return Response.json({ success: false, error: err.message }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}
