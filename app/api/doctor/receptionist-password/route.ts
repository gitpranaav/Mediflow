import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (String(session.role) !== "doctor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { receptionist_password?: string };
  const password = body.receptionist_password ?? "";
  if (typeof password !== "string" || password.trim().length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const db = await getDb();
  const receptionist_password_hash = await bcrypt.hash(password, 10);
  await db.collection("users").updateOne(
    { _id: new ObjectId(session.uid) },
    { $set: { receptionist_password_hash, updated_at: new Date().toISOString() } }
  );

  return NextResponse.json({ ok: true });
}

