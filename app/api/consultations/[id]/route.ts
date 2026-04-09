import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const db = await getDb();
  const role = String(session.role);
  const restrictedForReceptionist = new Set(["status", "ended_at", "doctor_id", "patient_id", "started_at"]);

  if (role === "receptionist") {
    for (const key of Object.keys(payload)) {
      if (restrictedForReceptionist.has(key)) {
        return NextResponse.json({ error: `Receptionist cannot update '${key}'.` }, { status: 403 });
      }
    }
  }

  await db.collection("consultations").updateOne(
    { _id: new ObjectId(id), doctor_id: new ObjectId(session.uid) },
    {
      $set: {
        ...payload,
        updated_at: new Date().toISOString(),
      },
    }
  );
  return NextResponse.json({ ok: true });
}
