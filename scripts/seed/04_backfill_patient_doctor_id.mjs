import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const demoDoctorEmail = "doctor@cliniq.demo";

const client = new MongoClient(uri);
await client.connect();
const db = client.db("cliniq");

const demoDoctor = await db.collection("users").findOne({ email: demoDoctorEmail });
if (!demoDoctor?._id) {
  throw new Error(`Demo doctor not found. Run seed:demo first or create user ${demoDoctorEmail}.`);
}

const patientsWithoutDoctor = await db
  .collection("patients")
  .find({ $or: [{ doctor_id: { $exists: false } }, { doctor_id: null }] })
  .project({ _id: 1 })
  .toArray();

let linkedFromConsultations = 0;
let linkedToDemoDoctor = 0;

for (const row of patientsWithoutDoctor) {
  const latest = await db
    .collection("consultations")
    .find({ patient_id: row._id, doctor_id: { $exists: true, $ne: null } })
    .sort({ created_at: -1 })
    .project({ doctor_id: 1 })
    .limit(1)
    .toArray();

  const doctorId = latest?.[0]?.doctor_id ?? demoDoctor._id;
  await db.collection("patients").updateOne({ _id: row._id }, { $set: { doctor_id: doctorId, updated_at: new Date().toISOString() } });

  if (latest?.[0]?.doctor_id) linkedFromConsultations += 1;
  else linkedToDemoDoctor += 1;
}

console.log(`Backfilled ${patientsWithoutDoctor.length} patients.`);
console.log(`- Linked from consultations: ${linkedFromConsultations}`);
console.log(`- Linked to demo doctor: ${linkedToDemoDoctor}`);

await client.close();

