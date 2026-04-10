import Groq from "groq-sdk";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { EXTRACT_FULL_SYSTEM_PROMPT } from "@/src/lib/emr/extractDeltaPrompt";
import { normalizeMedicationsArray } from "@/src/lib/emr/normalizeMedications";
import { buildClinicalSummary, buildPatientSummary } from "@/src/lib/emr/summaries";
import { enrichMedicationsWithIcd } from "@/src/lib/icd/enrichMedications";
import type { EMRSnapshot } from "@/src/lib/emr/types";
import { getDb } from "@/src/lib/mongodb/client";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing environment for extraction" }, { status: 500 });
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: EXTRACT_FULL_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            transcript_text: body.transcript_text,
            patient_context: body.patient_context ?? {},
          }),
        },
      ],
      temperature: 0.2,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const db = await getDb();
    const consultationId = new ObjectId(body.consultation_id);

    const diagnosisRaw = Array.isArray(parsed.diagnosis) ? parsed.diagnosis : [];
    const diagnosis_text = diagnosisRaw.map((x: unknown) => String(x ?? "").trim()).filter(Boolean);

    let snapshotForStore: EMRSnapshot = {
      vitals: parsed.vitals ?? undefined,
      chief_complaint: parsed.chief_complaint ?? null,
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.map((x: unknown) => String(x).trim()).filter(Boolean) : [],
      diagnosis_text,
      medications: normalizeMedicationsArray(parsed.medications),
      lab_tests_ordered: Array.isArray(parsed.lab_tests_ordered)
        ? parsed.lab_tests_ordered.map((x: unknown) => String(x).trim()).filter(Boolean)
        : [],
      clinical_summary: parsed.clinical_summary ?? null,
      patient_summary: parsed.patient_summary ?? null,
    };
    snapshotForStore = await enrichMedicationsWithIcd(db, snapshotForStore);
    snapshotForStore.clinical_summary = snapshotForStore.clinical_summary ?? buildClinicalSummary(snapshotForStore);
    snapshotForStore.patient_summary = snapshotForStore.patient_summary ?? buildPatientSummary(snapshotForStore);

    const emrResult = await db.collection("emr_entries").findOneAndUpdate(
      { consultation_id: consultationId },
      {
        $set: {
          chief_complaint: parsed.chief_complaint ?? null,
          symptoms: parsed.symptoms ?? [],
          assessment: parsed.assessment ?? null,
          clinical_summary: snapshotForStore.clinical_summary ?? null,
          patient_summary: snapshotForStore.patient_summary ?? null,
          // Best-effort: also store into snapshot for the live panel
          snapshot: snapshotForStore,
          requires_review: true,
          updated_at: new Date().toISOString(),
        },
        $setOnInsert: {
          consultation_id: consultationId,
          created_at: new Date().toISOString(),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    const emrEntry = emrResult;

    if (emrEntry?._id && Array.isArray(parsed.icd_suggestions)) {
      for (const suggestion of parsed.icd_suggestions) {
        const code = String(suggestion.code ?? "").trim();
        if (!code) continue;
        const icd = await db.collection("icd10_codes").findOne({ code }, { projection: { description: 1 } });
        if (!icd?._id) continue;
        await db.collection("emr_diagnoses").insertOne({
          emr_entry_id: emrEntry._id,
          icd_code_id: icd._id,
          consultation_id: consultationId,
          diagnosis_text: suggestion.description ?? icd.description ?? code,
          is_primary: false,
          confidence: suggestion.confidence ?? "ai_suggested",
          added_by: "ai",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ ...parsed, snapshot: snapshotForStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Extraction failed" }, { status: 500 });
  }
}
