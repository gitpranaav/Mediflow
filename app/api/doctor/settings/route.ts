import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (String(session.role) !== "doctor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(session.uid) },
    { projection: { clinic_name: 1, clinic_address: 1, clinic_phone: 1, registration_number: 1, doctor_name: 1, name: 1 } }
  );

  return NextResponse.json({
    clinic_name: user?.clinic_name ?? "",
    clinic_address: user?.clinic_address ?? "",
    clinic_phone: user?.clinic_phone ?? "",
    registration_number: user?.registration_number ?? "",
    doctor_name: user?.doctor_name ?? user?.name ?? "",
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (String(session.role) !== "doctor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    clinic_name?: string;
    clinic_address?: string;
    clinic_phone?: string;
    registration_number?: string;
    doctor_name?: string;
  };

  const payload = {
    clinic_name: String(body.clinic_name ?? "").trim(),
    clinic_address: String(body.clinic_address ?? "").trim(),
    clinic_phone: String(body.clinic_phone ?? "").trim(),
    registration_number: String(body.registration_number ?? "").trim(),
    doctor_name: String(body.doctor_name ?? "").trim(),
    updated_at: new Date().toISOString(),
  };

  const db = await getDb();
  await db.collection("users").updateOne({ _id: new ObjectId(session.uid) }, { $set: payload });

  return NextResponse.json({ ok: true });
}