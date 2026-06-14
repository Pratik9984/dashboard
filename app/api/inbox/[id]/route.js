import { getDb } from '@/app/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { requireAdmin } from '@/app/lib/firebaseAdmin';

export async function GET(req, { params }) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  try {
    const docRef = doc(db, 'emails', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return Response.json({ error: 'Email not found' }, { status: 404 });
    }
    return Response.json({ ...docSnap.data(), id: docSnap.id });
  } catch (err) {
    console.error("Error fetching single email GET:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await requireAdmin(req);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const updates = await req.json(); // { read: true } or { starred: true }
  await updateDoc(doc(db, 'emails', id), updates);
  return Response.json({ ok: true });
}
