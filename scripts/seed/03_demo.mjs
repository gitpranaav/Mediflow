import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const demoDoctorEmail = "doctor@cliniq.demo";
const demoDoctorPassword = process.env.DEMO_DOCTOR_PASSWORD || "doctor123";

const client = new MongoClient(uri);
await client.connect();
const db = client.db("cliniq");

const password_hash = await bcrypt.hash(demoDoctorPassword, 10);
const receptionist_password_hash = await bcrypt.hash(demoDoctorPassword, 10);
await db.collection("users").updateOne(
  { email: demoDoctorEmail },
  {
    $set: {
      email: demoDoctorEmail,
      name: "Dr. Arjun Mehta",
      specialization: "General Physician",
      role: "doctor",
      password_hash,
      receptionist_password_hash,
      updated_at: new Date().toISOString(),
    },
    $setOnInsert: {
      created_at: new Date().toISOString(),
    },
  },
  { upsert: true }
);
const doctor = await db.collection("users").findOne({ email: demoDoctorEmail });

const patients = [
  { name: "Rohit Sharma", gender: "Male", dob: "1988-09-14", blood_group: "B+", phone: "+919876543210", chronic_conditions: ["Hypertension"] },
  { name: "Ananya Iyer", gender: "Female", dob: "1995-02-03", blood_group: "O+", phone: "+919820112233", allergies: ["Penicillin"] },
  { name: "Farhan Khan", gender: "Male", dob: "1979-06-22", blood_group: "A+", phone: "+919811009988", chronic_conditions: ["Type 2 Diabetes"] },
  { name: "Meera Nair", gender: "Female", dob: "1968-12-08", blood_group: "AB+", phone: "+919845667788" },
  { name: "Kabir Patel", gender: "Male", dob: "2002-04-17", blood_group: "O-", phone: "+919900221144" },
];

for (const patient of patients) {
  await db.collection("patients").updateOne(
    { doctor_id: doctor._id, phone: patient.phone },
    {
      $set: {
        ...patient,
        doctor_id: doctor._id,
        allergies: patient.allergies ?? [],
        chronic_conditions: patient.chronic_conditions ?? [],
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: { created_at: new Date().toISOString() },
    },
    { upsert: true }
  );
}

const patientDocs = await db.collection("patients").find({ doctor_id: doctor._id }).limit(5).toArray();
const transcriptSamples = [
  "Patient reports fever and sore throat for 2 days. No breathing difficulty.",
  "Complains of persistent acidity and bloating after meals.",
  "Reports headache and stress related poor sleep over one week.",
];

for (let i = 0; i < Math.min(3, patientDocs.length); i += 1) {
  const now = new Date();
  now.setDate(now.getDate() - (i + 1));
  const consultationResult = await db.collection("consultations").insertOne({
    doctor_id: doctor._id,
    patient_id: patientDocs[i]._id,
    type: "General",
    status: "completed",
    follow_up_of: null,
    started_at: now.toISOString(),
    ended_at: new Date(now.getTime() + 25 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  const transcriptResult = await db.collection("transcripts").insertOne({
    consultation_id: consultationResult.insertedId,
    raw_text: transcriptSamples[i],
    segments: [
      { id: crypto.randomUUID(), text: transcriptSamples[i], speaker: "patient", confidence: 0.89, timestamp: now.toISOString() },
    ],
    processing_status: "completed",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  const emrResult = await db.collection("emr_entries").insertOne({
    consultation_id: consultationResult.insertedId,
    chief_complaint: transcriptSamples[i].split(".")[0],
    symptoms: ["fatigue"],
    assessment: "Requires routine follow-up.",
    clinical_summary: transcriptSamples[i],
    requires_review: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });

  const icd = await db.collection("icd10_codes").findOne({});
  if (icd) {
    await db.collection("emr_diagnoses").insertOne({
      consultation_id: consultationResult.insertedId,
      emr_entry_id: emrResult.insertedId,
      icd_code_id: icd._id,
      diagnosis_text: icd.description,
      is_primary: true,
      confidence: "high",
      added_by: "doctor",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }
}

console.log("Demo seed complete.");
console.log(`Doctor login email: ${demoDoctorEmail}`);
console.log(`Doctor login password: ${demoDoctorPassword}`);
await client.close();
