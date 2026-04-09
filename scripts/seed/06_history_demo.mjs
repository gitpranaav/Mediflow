import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const client = new MongoClient(uri);
await client.connect();
const db = client.db("cliniq");

const demoPassword = process.env.DEMO_DOCTOR_PASSWORD || "doctor123";
const password_hash = await bcrypt.hash(demoPassword, 10);
const receptionist_password_hash = await bcrypt.hash(demoPassword, 10);

// Ensure 2 doctors (general + gynec)
await db.collection("users").updateOne(
  { email: "doctor@cliniq.demo" },
  {
    $set: {
      email: "doctor@cliniq.demo",
      name: "Dr. Arjun Mehta",
      specialization: "General Physician",
      specialty_code: "general",
      role: "doctor",
      password_hash,
      receptionist_password_hash,
      updated_at: new Date().toISOString(),
    },
    $setOnInsert: { created_at: new Date().toISOString() },
  },
  { upsert: true }
);

await db.collection("users").updateOne(
  { email: "gynec@cliniq.demo" },
  {
    $set: {
      email: "gynec@cliniq.demo",
      name: "Dr. Nisha Kulkarni",
      specialization: "Gynecologist",
      specialty_code: "gynec",
      role: "doctor",
      password_hash,
      receptionist_password_hash,
      updated_at: new Date().toISOString(),
    },
    $setOnInsert: { created_at: new Date().toISOString() },
  },
  { upsert: true }
);

const generalDoctor = await db.collection("users").findOne({ email: "doctor@cliniq.demo" });
const gynecDoctor = await db.collection("users").findOne({ email: "gynec@cliniq.demo" });
if (!generalDoctor?._id || !gynecDoctor?._id) throw new Error("Doctors not found after upsert");

// Pick a couple patients by phone (created by seed:demo)
const p1 = await db.collection("patients").findOne({ phone: "+919820112233" }); // Ananya (female)
const p2 = await db.collection("patients").findOne({ phone: "+919845667788" }); // Meera (female)
if (!p1?._id || !p2?._id) throw new Error("Expected demo patients not found. Run seed:demo first.");

// Link patients to both doctors (patient can have multiple doctors)
for (const patient of [p1, p2]) {
  await db.collection("patient_doctors").updateOne(
    { patient_id: patient._id, doctor_id: generalDoctor._id },
    { $setOnInsert: { patient_id: patient._id, doctor_id: generalDoctor._id, created_at: new Date().toISOString() } },
    { upsert: true }
  );
  await db.collection("patient_doctors").updateOne(
    { patient_id: patient._id, doctor_id: gynecDoctor._id },
    { $setOnInsert: { patient_id: patient._id, doctor_id: gynecDoctor._id, created_at: new Date().toISOString() } },
    { upsert: true }
  );
}

// Core shared history (one doc per patient)
for (const patient of [p1, p2]) {
  await db.collection("patient_history").updateOne(
    { patient_id: patient._id },
    {
      $set: {
        patient_id: patient._id,
        core: {
          allergies: patient.allergies ?? [],
          problem_list: patient.chronic_conditions ?? [],
          past_surgeries: patient.phone === "+919845667788" ? ["Appendectomy (2010)"] : [],
          family_history: patient.phone === "+919820112233" ? "Mother: hypothyroidism." : "No significant family history reported.",
          social_history: patient.phone === "+919820112233" ? "Non-smoker. Occasional tea/coffee." : "Non-smoker. No alcohol.",
          immunizations: ["Tetanus booster (2022)"],
          active_meds: patient.phone === "+919845667788" ? ["Pantoprazole 40mg OD"] : [],
        },
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: { created_at: new Date().toISOString() },
    },
    { upsert: true }
  );
}

// Specialty history (gynec scoped to gynec doctor)
await db.collection("patient_specialty_history").updateOne(
  { patient_id: p1._id, specialty_code: "gynec", doctor_id: gynecDoctor._id },
  {
    $set: {
      patient_id: p1._id,
      specialty_code: "gynec",
      doctor_id: gynecDoctor._id,
      data: {
        lmp: "2026-03-12",
        cycle_history: "Regular 28-30 days.",
        g_p_a_l: "G0P0A0L0",
        pregnancy_status: "not_pregnant",
        contraception: "None",
        notes: "Reports mild dysmenorrhea occasionally.",
      },
      updated_at: new Date().toISOString(),
    },
    $setOnInsert: { created_at: new Date().toISOString() },
  },
  { upsert: true }
);

await db.collection("patient_specialty_history").updateOne(
  { patient_id: p2._id, specialty_code: "gynec", doctor_id: gynecDoctor._id },
  {
    $set: {
      patient_id: p2._id,
      specialty_code: "gynec",
      doctor_id: gynecDoctor._id,
      data: {
        lmp: "2026-02-20",
        cycle_history: "Irregular cycles.",
        g_p_a_l: "G2P2A0L2",
        pregnancy_status: "not_pregnant",
        contraception: "Copper-T (2018)",
        notes: "Perimenopausal symptoms discussed.",
      },
      updated_at: new Date().toISOString(),
    },
    $setOnInsert: { created_at: new Date().toISOString() },
  },
  { upsert: true }
);

console.log("History demo seed complete.");
console.log("General doctor:", "doctor@cliniq.demo", demoPassword);
console.log("Gynec doctor:", "gynec@cliniq.demo", demoPassword);

await client.close();

