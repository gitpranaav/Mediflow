import Groq from "groq-sdk";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { logConsultationAudit } from "@/src/lib/audit/consultationLedger";
import { BASELINE_PROMPT_VERSION, buildDeltaExtractionRequest } from "@/src/lib/emr/extractionRequest";
import { startExtractionMetric } from "@/src/lib/observability/baseline";
import { enrichMedicationsWithIcd } from "@/src/lib/icd/enrichMedications";
import { applyEMROps } from "@/src/lib/emr/merge";
import { buildClinicalSummary, buildPatientSummary } from "@/src/lib/emr/summaries";
import type { EMROp, EMRSnapshot, TranscriptSegment } from "@/src/lib/emr/types";
import { getDb } from "@/src/lib/mongodb/client";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");
  return new Groq({ apiKey });
}

function parseProviderError(error: unknown): {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof Error && error.message === "Missing GROQ_API_KEY") {
    return { status: 500, code: "missing_api_key", message: "Missing GROQ_API_KEY", retryable: false };
  }

  const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
  const rawMessage = String((error as any)?.error?.message ?? (error as any)?.message ?? "Extraction failed").trim();
  const msg = rawMessage || "Extraction failed";
  const lower = msg.toLowerCase();

  if (status === 401 || status === 403 || lower.includes("invalid api key") || lower.includes("authentication")) {
    return { status: 502, code: "provider_auth", message: msg, retryable: false };
  }
  if (status === 429 || lower.includes("rate limit") || lower.includes("quota") || lower.includes("insufficient")) {
    return { status: 429, code: "provider_rate_limited", message: msg, retryable: true };
  }
  if (status >= 500) {
    return { status: 503, code: "provider_unavailable", message: msg, retryable: true };
  }

  return { status: 500, code: "extract_delta_failed", message: msg, retryable: false };
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metric = startExtractionMetric("delta");
  try {
    const body = (await request.json()) as {
      consultation_id?: string;
      segments_delta?: TranscriptSegment[];
      emr_snapshot?: EMRSnapshot | null;
      cursor?: { last_final_segment_id?: string | null; last_final_index?: number | null } | null;
      patient_allergies?: string[];
    };

    if (!body.consultation_id) return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
    const segmentsDelta = Array.isArray(body.segments_delta) ? body.segments_delta : [];
    const consultationId = new ObjectId(body.consultation_id);

    if (!segmentsDelta.length) {
      metric.skip();
      return NextResponse.json({ operations: [], snapshot: body.emr_snapshot ?? {}, new_cursor: body.cursor ?? null });
    }

    const groq = getGroq();
    const extractionRequest = buildDeltaExtractionRequest({
      segments_delta: segmentsDelta, emr_snapshot: body.emr_snapshot, patient_allergies: body.patient_allergies,
    });
    metric.providerStart(extractionRequest, BASELINE_PROMPT_VERSION, segmentsDelta.length);
    const completion = await groq.chat.completions.create(extractionRequest);
    metric.providerEnd(completion.usage);

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { operations?: EMROp[] };
    const operations = Array.isArray(parsed.operations) ? parsed.operations : [];
    let merged = applyEMROps(body.emr_snapshot ?? {}, operations);

    const db = await getDb();
    merged = await enrichMedicationsWithIcd(db, merged as EMRSnapshot);
    merged.clinical_summary = merged.clinical_summary ?? buildClinicalSummary(merged);
    merged.patient_summary = merged.patient_summary ?? buildPatientSummary(merged);

    // Persist: store snapshot + cursor + requires_review=true (doctor confirms later)
    const last = segmentsDelta[segmentsDelta.length - 1];
    const newCursor = {
      last_final_segment_id: last?.id ?? body.cursor?.last_final_segment_id ?? null,
      last_final_index: typeof body.cursor?.last_final_index === "number" ? body.cursor.last_final_index + segmentsDelta.length : segmentsDelta.length - 1,
    };

    metric.stage("persistence");
    await db.collection("emr_entries").updateOne(
      { consultation_id: consultationId },
      {
        $set: {
          snapshot: merged,
          extraction_cursor: newCursor,
          requires_review: true,
          updated_at: new Date().toISOString(),
        },
        $setOnInsert: {
          consultation_id: consultationId,
          created_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    const consultation = await db.collection("consultations").findOne({ _id: consultationId }, { projection: { patient_id: 1 } });
    metric.stage("audit");
    await logConsultationAudit(db, {
      consultationId,
      patientId: consultation?.patient_id ?? null,
      actorId: session.uid,
      actorRole: String(session.role),
      source: "ai_delta",
      eventType: "ai_delta_edit",
      before: body.emr_snapshot ?? null,
      after: merged,
      metadata: {
        route: "emr.extract-delta.post",
        operation_count: operations.length,
        segment_count: segmentsDelta.length,
        segment_ids: segmentsDelta.map((s) => s.id),
      },
    });

    metric.success(operations.length);
    return NextResponse.json({ operations, snapshot: merged, new_cursor: newCursor });
  } catch (error) {
    const parsed = parseProviderError(error);
    return NextResponse.json(
      { error: parsed.message, error_code: parsed.code, retryable: parsed.retryable },
      { status: parsed.status }
    );
  } finally {
    metric.finish();
  }
}

