import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const client = new MongoClient(uri);
await client.connect();
const db = client.db("cliniq");

let inserted = 0;
let skipped = 0;

// Primary source of truth: consultations (patient_id, doctor_id)
const pairs = await db
  .collection("consultations")
  .aggregate([
    { $match: { patient_id: { $exists: true, $ne: null }, doctor_id: { $exists: true, $ne: null } } },
    { $group: { _id: { patient_id: "$patient_id", doctor_id: "$doctor_id" } } },
  ])
  .toArray();

for (const row of pairs) {
  const { patient_id, doctor_id } = row._id ?? {};
  if (!patient_id || !doctor_id) continue;
  const res = await db.collection("patient_doctors").updateOne(
    { patient_id, doctor_id },
    { $setOnInsert: { patient_id, doctor_id, created_at: new Date().toISOString() } },
    { upsert: true }
  );
  if (res.upsertedCount) inserted += 1;
  else skipped += 1;
}

// Fallback: existing patients.doctor_id (older data)
const legacy = await db
  .collection("patients")
  .find({ doctor_id: { $exists: true, $ne: null } })
  .project({ _id: 1, doctor_id: 1 })
  .toArray();

for (const row of legacy) {
  const patient_id = row._id;
  const doctor_id = row.doctor_id;
  if (!patient_id || !doctor_id) continue;
  const res = await db.collection("patient_doctors").updateOne(
    { patient_id, doctor_id },
    { $setOnInsert: { patient_id, doctor_id, created_at: new Date().toISOString() } },
    { upsert: true }
  );
  if (res.upsertedCount) inserted += 1;
  else skipped += 1;
}

console.log(`Backfilled patient_doctors links.`);
console.log(`- Inserted: ${inserted}`);
console.log(`- Skipped (already present): ${skipped}`);

await client.close();

