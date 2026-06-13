import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export async function GET(req, { params }) {
  try {
    const docRef = doc(db, 'emails', params.id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return Response.json({ error: 'Email not found' }, { status: 404 });
    }
    return Response.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err) {
    console.error("Error fetching single email GET:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const updates = await req.json(); // { read: true } or { starred: true }
  await updateDoc(doc(db, 'emails', params.id), updates);
  return Response.json({ ok: true });
}
