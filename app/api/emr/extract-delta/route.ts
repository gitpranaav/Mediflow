import Groq from "groq-sdk";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { applyEMROps } from "@/src/lib/emr/merge";
import type { EMROp, EMRSnapshot, TranscriptSegment } from "@/src/lib/emr/types";
import { getDb } from "@/src/lib/mongodb/client";

const SYSTEM_PROMPT = `You are a clinical NLP engine for an Indian EMR system.

LANGUAGE: All extracted string values MUST be in English (chief complaint, symptoms, diagnosis_text, medication names when transcribed in another script, summaries, lab names, etc.), even if the transcript is Hindi or any other language. Translate faithfully; do not add facts not spoken.

You MUST operate incrementally:
- You will receive ONLY new FINALIZED transcript segments (delta) plus a compact EMR snapshot.
- Do NOT rewrite the full EMR. Return ONLY operations to apply.
- Do NOT invent medical facts. Only extract what is explicitly stated.
- Do NOT generate differential diagnoses.

Return JSON with:
{
  "operations": [
    { "op": "set_fact" | "update_fact" | "retract_fact" | "mark_uncertain",
      "path": "dot.path.or.array[index]",
      "value": any (only for set_fact/update_fact),
      "confidence": "high"|"medium"|"low",
      "evidence_segment_ids": [string]
    }
  ]
}

Allowed paths (examples):
- vitals.bp_systolic, vitals.bp_diastolic, vitals.heart_rate, vitals.temperature, vitals.spo2, vitals.weight, vitals.height
- chief_complaint
- symptoms (array of strings) -> set_fact path \"symptoms\" value [..]
- diagnosis_text (array of strings)
- medications (array of objects: {name,dosage,frequency,duration,route,instructions})
- lab_tests_ordered (array of strings)
- clinical_summary
- patient_summary

Correction policy:
- If the speaker corrects themselves (e.g. \"no no\", \"actually\", \"sorry\"), update the prior fact (use update_fact/retract_fact).
- If conflicting without clear correction, prefer latest but mark_uncertain for that path.
`;

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY");
  return new Groq({ apiKey });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      consultation_id?: string;
      segments_delta?: TranscriptSegment[];
      emr_snapshot?: EMRSnapshot | null;
      cursor?: { last_final_segment_id?: string | null; last_final_index?: number | null } | null;
    };

    if (!body.consultation_id) return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
    const segmentsDelta = Array.isArray(body.segments_delta) ? body.segments_delta : [];
    const consultationId = new ObjectId(body.consultation_id);

    if (!segmentsDelta.length) {
      return NextResponse.json({ operations: [], snapshot: body.emr_snapshot ?? {}, new_cursor: body.cursor ?? null });
    }

    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            segments_delta: segmentsDelta.map((s) => ({
              id: s.id,
              text: s.text,
              confidence: s.confidence ?? null,
              language: s.language ?? null,
              start_ms: s.start_ms ?? null,
              end_ms: s.end_ms ?? null,
            })),
            emr_snapshot: body.emr_snapshot ?? {},
          }),
        },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { operations?: EMROp[] };
    const operations = Array.isArray(parsed.operations) ? parsed.operations : [];
    const merged = applyEMROps(body.emr_snapshot ?? {}, operations);

    // Persist: store snapshot + cursor + requires_review=true (doctor confirms later)
    const db = await getDb();
    const last = segmentsDelta[segmentsDelta.length - 1];
    const newCursor = {
      last_final_segment_id: last?.id ?? body.cursor?.last_final_segment_id ?? null,
      last_final_index: typeof body.cursor?.last_final_index === "number" ? body.cursor.last_final_index + segmentsDelta.length : segmentsDelta.length - 1,
    };

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

    return NextResponse.json({ operations, snapshot: merged, new_cursor: newCursor });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Extraction failed" }, { status: 500 });
  }
}

