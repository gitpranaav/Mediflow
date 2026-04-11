import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid consultation id" }, { status: 400 });
  }

  const db = await getDb();
  const consultationId = new ObjectId(id);
  const doctorId = new ObjectId(session.uid);
  const consultation = await db.collection("consultations").findOne({ _id: consultationId, doctor_id: doctorId }, { projection: { _id: 1 } });
  if (!consultation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db
    .collection("consultation_audit_events")
    .find({ consultation_id: consultationId })
    .sort({ sequence_no: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json({
    events: events.map((event) => ({
      id: event._id.toString(),
      consultation_id: event.consultation_id?.toString?.() ?? null,
      patient_id: event.patient_id?.toString?.() ?? null,
      actor_id: event.actor_id?.toString?.() ?? null,
      actor_role: event.actor_role ?? null,
      source: event.source ?? null,
      event_type: event.event_type ?? null,
      sequence_no: event.sequence_no ?? null,
      created_at: event.created_at ?? null,
      changed_paths: Array.isArray(event.changed_paths) ? event.changed_paths : [],
      metadata: event.metadata ?? null,
      event_hash: event.event_hash ?? null,
      prev_hash: event.prev_hash ?? null,
    })),
  });
}
