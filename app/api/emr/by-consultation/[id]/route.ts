import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { logConsultationAudit } from "@/src/lib/audit/consultationLedger";
import { getDb } from "@/src/lib/mongodb/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const db = await getDb();
  const doc = await db.collection("emr_entries").findOne({ consultation_id: new ObjectId(id) });
  if (!doc) return NextResponse.json({ emr_entry: null });
  return NextResponse.json({
    emr_entry: {
      id: doc._id.toString(),
      consultation_id: doc.consultation_id.toString(),
      snapshot: doc.snapshot ?? null,
      extraction_cursor: doc.extraction_cursor ?? null,
      requires_review: doc.requires_review ?? false,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    },
  });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await request.json()) as { snapshot?: Record<string, unknown> };
  const role = String(session.role);
  const incomingSnapshot = (body.snapshot ?? {}) as Record<string, unknown>;
  const receptionistAllowed = new Set(["vitals", "chief_complaint", "symptoms"]);
  const filteredSnapshot =
    role === "receptionist"
      ? Object.fromEntries(Object.entries(incomingSnapshot).filter(([key]) => receptionistAllowed.has(key)))
      : incomingSnapshot;
  const db = await getDb();
  const consultationObjectId = new ObjectId(id);
  const existing = await db.collection("emr_entries").findOne({ consultation_id: consultationObjectId });
  const consultation = await db.collection("consultations").findOne({ _id: consultationObjectId }, { projection: { patient_id: 1 } });
  const mergedSnapshot =
    role === "receptionist"
      ? { ...(existing?.snapshot ?? {}), ...filteredSnapshot }
      : filteredSnapshot;
  await db.collection("emr_entries").updateOne(
    { consultation_id: consultationObjectId },
    {
      $set: {
        snapshot: mergedSnapshot,
        requires_review: true,
        updated_by: new ObjectId(session.uid),
        updated_by_role: role,
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: {
        consultation_id: consultationObjectId,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  await logConsultationAudit(db, {
    consultationId: consultationObjectId,
    patientId: consultation?.patient_id ?? null,
    actorId: session.uid,
    actorRole: role,
    source: role === "doctor" ? "doctor_manual" : "receptionist_manual",
    eventType: role === "doctor" ? "doctor_field_edit" : "receptionist_field_edit",
    before: existing?.snapshot ?? null,
    after: mergedSnapshot,
    metadata: { route: "emr.by-consultation.put" },
  });

  return NextResponse.json({ ok: true });
}

