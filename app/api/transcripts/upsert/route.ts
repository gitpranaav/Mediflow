import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { logConsultationAudit } from "@/src/lib/audit/consultationLedger";
import { getDb } from "@/src/lib/mongodb/client";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const consultationIdRaw = url.searchParams.get("consultation_id");
  if (!consultationIdRaw) {
    return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
  }

  let consultationId: ObjectId;
  try {
    consultationId = new ObjectId(consultationIdRaw);
  } catch {
    return NextResponse.json({ error: "Invalid consultation_id" }, { status: 400 });
  }

  const db = await getDb();
  const consultation = await db.collection("consultations").findOne({ _id: consultationId });
  if (!consultation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessionUid = String(session.uid);
  const doctorId = consultation?.doctor_id?.toString?.();
  const receptionistId = consultation?.receptionist_id?.toString?.();
  const canAccess = sessionUid === doctorId || (receptionistId ? sessionUid === receptionistId : false);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transcript = await db.collection("transcripts").findOne(
    { consultation_id: consultationId },
    { projection: { _id: 0, raw_text: 1, segments: 1, processing_status: 1, updated_at: 1, created_at: 1 } }
  );

  return NextResponse.json({ transcript: transcript ?? null });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.consultation_id) {
    return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
  }

  const db = await getDb();
  const consultationId = new ObjectId(body.consultation_id);
  const [existingTranscript, consultation] = await Promise.all([
    db.collection("transcripts").findOne({ consultation_id: consultationId }),
    db.collection("consultations").findOne({ _id: consultationId }, { projection: { patient_id: 1 } }),
  ]);

  await db.collection("transcripts").updateOne(
    { consultation_id: consultationId },
    {
      $set: {
        raw_text: body.raw_text ?? "",
        segments: Array.isArray(body.segments) ? body.segments : [],
        processing_status: body.processing_status ?? "in_progress",
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: {
        consultation_id: consultationId,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  const nextStatus = String(body.processing_status ?? "in_progress");
  const prevStatus = String(existingTranscript?.processing_status ?? "");

  if (!existingTranscript) {
    await logConsultationAudit(db, {
      consultationId,
      patientId: consultation?.patient_id ?? null,
      actorId: session.uid,
      actorRole: String(session.role),
      source: "system",
      eventType: "transcription_started",
      before: { processing_status: null },
      after: { processing_status: nextStatus },
      metadata: { route: "transcripts.upsert.post" },
      allowNoop: true,
    });
  }

  if (nextStatus === "completed" && prevStatus !== "completed") {
    await logConsultationAudit(db, {
      consultationId,
      patientId: consultation?.patient_id ?? null,
      actorId: session.uid,
      actorRole: String(session.role),
      source: "system",
      eventType: "transcription_stopped",
      before: { processing_status: prevStatus || null },
      after: { processing_status: nextStatus },
      metadata: {
        route: "transcripts.upsert.post",
        segment_count: Array.isArray(body.segments) ? body.segments.length : 0,
      },
      allowNoop: true,
    });
  }

  return NextResponse.json({ ok: true });
}
