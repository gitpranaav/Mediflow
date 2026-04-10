import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

type Params = { params: Promise<{ id: string }> };

type SnapshotMedication = {
  name?: unknown;
  dosage?: unknown;
  frequency?: unknown;
  duration?: unknown;
  route?: unknown;
  instructions?: unknown;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function asMedicationArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const med = (item ?? {}) as SnapshotMedication;
      const name = normalizeText(med.name);
      if (!name) return null;
      return {
        name,
        dosage: normalizeText(med.dosage) || null,
        frequency: normalizeText(med.frequency) || null,
        duration: normalizeText(med.duration) || null,
        route: normalizeText(med.route) || null,
        instructions: normalizeText(med.instructions) || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

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

  const consultationObjectId = new ObjectId(id);
  const doctorObjectId = new ObjectId(session.uid);
  const nowIso = new Date().toISOString();

  const consultation = await db.collection("consultations").findOneAndUpdate(
    { _id: consultationObjectId, doctor_id: doctorObjectId },
    {
      $set: {
        ...payload,
        updated_at: nowIso,
      },
    },
    { returnDocument: "after" }
  );

  if (!consultation) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }

  const shouldFinalize = String(payload.status ?? "") === "completed";
  if (shouldFinalize && consultation.patient_id) {
    const emr = await db.collection("emr_entries").findOne({ consultation_id: consultationObjectId });
    const snapshot = (emr?.snapshot ?? {}) as Record<string, unknown>;
    const medications = asMedicationArray(snapshot.medications);
    const diagnosisText = asStringArray(snapshot.diagnosis_text);

    await db.collection("prescriptions").updateOne(
      { consultation_id: consultationObjectId },
      {
        $set: {
          consultation_id: consultationObjectId,
          patient_id: consultation.patient_id,
          doctor_id: doctorObjectId,
          medications,
          diagnosis_text: diagnosisText,
          issued_at: normalizeText(payload.ended_at) || nowIso,
          updated_at: nowIso,
        },
        $setOnInsert: {
          created_at: nowIso,
        },
      },
      { upsert: true }
    );

    const existingHistory = await db.collection("patient_history").findOne({ patient_id: consultation.patient_id });
    const existingCore = ((existingHistory as { core?: Record<string, unknown> } | null)?.core ?? {}) as Record<string, unknown>;
    const existingProblemList = asStringArray(existingCore.problem_list);
    const mergedProblemList = Array.from(new Set([...existingProblemList, ...diagnosisText]));
    const activeMeds = medications.map((med) => med.name);

    await db.collection("patient_history").updateOne(
      { patient_id: consultation.patient_id },
      {
        $set: {
          patient_id: consultation.patient_id,
          core: {
            ...existingCore,
            problem_list: mergedProblemList,
            active_meds: activeMeds,
            last_consultation_at: normalizeText(payload.ended_at) || nowIso,
            last_diagnosis: (diagnosisText[0] ?? normalizeText(existingCore.last_diagnosis)) || null,
          },
          updated_at: nowIso,
        },
        $setOnInsert: {
          created_at: nowIso,
        },
      },
      { upsert: true }
    );

    const doctor = await db.collection("users").findOne({ _id: doctorObjectId }, { projection: { specialty_code: 1 } });
    const specialtyCode = normalizeText((doctor as { specialty_code?: unknown } | null)?.specialty_code) || "general";
    const specialtyFilter = {
      patient_id: consultation.patient_id,
      doctor_id: doctorObjectId,
      specialty_code: specialtyCode,
    };
    const existingSpecialty = await db.collection("patient_specialty_history").findOne(specialtyFilter);
    const existingSpecialtyData =
      ((existingSpecialty as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;

    await db.collection("patient_specialty_history").updateOne(
      specialtyFilter,
      {
        $set: {
          ...specialtyFilter,
          data: {
            ...existingSpecialtyData,
            active_meds: activeMeds,
            diagnoses: diagnosisText,
            last_diagnosis: (diagnosisText[0] ?? normalizeText(existingSpecialtyData.last_diagnosis)) || null,
            last_consultation_at: normalizeText(payload.ended_at) || nowIso,
          },
          updated_at: nowIso,
        },
        $setOnInsert: {
          created_at: nowIso,
        },
      },
      { upsert: true }
    );
  }

  return NextResponse.json({ ok: true, finalized_sync: shouldFinalize });
}
