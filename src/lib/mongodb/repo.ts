import { ObjectId } from "mongodb";

import { getDb } from "@/src/lib/mongodb/client";

export function asObjectId(value: string) {
  return new ObjectId(value);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  return db.collection("users").findOne({ email: email.toLowerCase() });
}

export async function getUserById(id: string) {
  const db = await getDb();
  return db.collection("users").findOne({ _id: asObjectId(id) });
}

export async function createPatient(payload: Record<string, unknown>) {
  const db = await getDb();
  const result = await db.collection("patients").insertOne({
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return result.insertedId.toString();
}

export async function createOrUpdatePatientByPhone(payload: {
  phone: string;
  name: string;
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  allergies?: string[];
  chronic_conditions?: string[];
  address?: string | null;
}) {
  const db = await getDb();
  const phone = payload.phone.trim();
  const now = new Date().toISOString();
  const result = await db.collection("patients").findOneAndUpdate(
    { phone },
    {
      $set: {
        phone,
        name: payload.name,
        dob: payload.dob ?? null,
        gender: payload.gender ?? null,
        blood_group: payload.blood_group ?? null,
        allergies: payload.allergies ?? [],
        chronic_conditions: payload.chronic_conditions ?? [],
        address: payload.address ?? null,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result?._id?.toString() ?? null;
}

export async function ensurePatientDoctorLink(patientId: string, doctorId: string) {
  const db = await getDb();
  await db.collection("patient_doctors").updateOne(
    { patient_id: asObjectId(patientId), doctor_id: asObjectId(doctorId) },
    { $setOnInsert: { patient_id: asObjectId(patientId), doctor_id: asObjectId(doctorId), created_at: new Date().toISOString() } },
    { upsert: true }
  );
}
