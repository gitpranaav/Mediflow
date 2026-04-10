import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";
import { normalizeConsultationType } from "@/src/lib/consultations/visitTypes";

interface CreateConsultationBody {
  patient_id?: string;
  type?: string;
  chief_complaint?: string;
  doctor_id?: string;
  /** Optional prior visit this consultation follows (same patient + doctor). */
  follow_up_of?: string;
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

  const doctorObjectId = new ObjectId(session.uid);
  if (body.doctor_id && body.doctor_id !== session.uid) {
    return NextResponse.json({ error: "doctor_id does not match the signed-in practice." }, { status: 403 });
  }

  const patientObjectId = new ObjectId(body.patient_id);
  const db = await getDb();

  const link = await db.collection("patient_doctors").findOne({ patient_id: patientObjectId, doctor_id: doctorObjectId });
  if (!link) {
    return NextResponse.json({ error: "Patient is not linked to this doctor." }, { status: 403 });
  }

  let followUpOfId: ObjectId | undefined;
  if (body.follow_up_of?.trim()) {
    if (!ObjectId.isValid(body.follow_up_of.trim())) {
      return NextResponse.json({ error: "Invalid follow_up_of consultation id." }, { status: 400 });
    }
    followUpOfId = new ObjectId(body.follow_up_of.trim());
    const prior = await db.collection("consultations").findOne({
      _id: followUpOfId,
      patient_id: patientObjectId,
      doctor_id: doctorObjectId,
    });
    if (!prior) {
      return NextResponse.json({ error: "Prior consultation not found for this patient." }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const role = String(session.role);
  const visitType = normalizeConsultationType(body.type);

  const inserted = await db.collection("consultations").insertOne({
    doctor_id: doctorObjectId,
    patient_id: patientObjectId,
    type: visitType,
    status: "active",
    started_at: now,
    follow_up_of: followUpOfId ?? null,
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
