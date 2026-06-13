import { NextResponse } from "next/server";
import { getDb, collection, getDocs } from "@/app/lib/firebase";

export async function GET() {
  try {
    const db = getDb();
    const snap = await getDocs(collection(db, "users"));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, count: users.length, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
