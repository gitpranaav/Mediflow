import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

interface CreateConsultationBody {
  patient_id?: string;
  type?: string;
  chief_complaint?: string;
  doctor_id?: string;
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CreateConsultationBody;
  if (!body.patient_id) {
    return NextResponse.json({ error: "patient_id is required." }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const role = String(session.role);
  const inserted = await db.collection("consultations").insertOne({
    doctor_id: new ObjectId(session.uid),
    patient_id: new ObjectId(body.patient_id),
    type: body.type ?? "General",
    status: "active",
    started_at: now,
    intake_status: role === "receptionist" ? "done" : "not_required",
    intake_by: new ObjectId(session.uid),
    intake_by_role: role,
    intake_at: now,
    created_at: now,
    updated_at: now,
  });

  if (body.chief_complaint?.trim()) {
    await db.collection("emr_entries").insertOne({
      consultation_id: inserted.insertedId,
      snapshot: {
        chief_complaint: body.chief_complaint.trim(),
      },
      requires_review: false,
      updated_by: new ObjectId(session.uid),
      updated_by_role: role,
      created_at: now,
      updated_at: now,
    });
  }

  return NextResponse.json({ consultation_id: inserted.insertedId.toString() });
}
