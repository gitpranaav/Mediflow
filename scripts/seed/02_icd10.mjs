import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const commonIcdCodes = [
  ["J00", "Acute nasopharyngitis (common cold)", "Respiratory"],
  ["J06.9", "Acute upper respiratory infection, unspecified", "Respiratory"],
  ["J20.9", "Acute bronchitis, unspecified", "Respiratory"],
  ["J45.909", "Unspecified asthma, uncomplicated", "Respiratory"],
  ["I10", "Essential (primary) hypertension", "Cardiovascular"],
  ["I25.10", "Atherosclerotic heart disease", "Cardiovascular"],
  ["E11.9", "Type 2 diabetes mellitus without complications", "Endocrine"],
  ["E03.9", "Hypothyroidism, unspecified", "Endocrine"],
  ["K21.9", "Gastro-esophageal reflux disease without esophagitis", "Gastrointestinal"],
  ["K29.70", "Gastritis, unspecified", "Gastrointestinal"],
  ["K59.00", "Constipation, unspecified", "Gastrointestinal"],
  ["M54.5", "Low back pain", "Musculoskeletal"],
  ["M17.9", "Osteoarthritis of knee, unspecified", "Musculoskeletal"],
  ["G43.909", "Migraine, unspecified, not intractable", "Neurological"],
  ["R42", "Dizziness and giddiness", "Neurological"],
  ["F41.9", "Anxiety disorder, unspecified", "Mental Health"],
  ["F32.9", "Major depressive disorder, single episode, unspecified", "Mental Health"],
  ["N39.0", "Urinary tract infection, site not specified", "Infections"],
  ["A09", "Infectious gastroenteritis and colitis, unspecified", "Infections"],
  ["L20.9", "Atopic dermatitis, unspecified", "Dermatology"],
  ["L30.9", "Dermatitis, unspecified", "Dermatology"],
  ["N92.6", "Irregular menstruation, unspecified", "OB/Gyn"],
  ["N97.9", "Female infertility, unspecified", "OB/Gyn"],
  ["J18.9", "Pneumonia, unspecified organism", "Respiratory"],
  ["Z00.00", "General adult medical examination without abnormal findings", "Preventive"],
  ["Z23", "Encounter for immunization", "Preventive"],
];

const client = new MongoClient(uri);
await client.connect();
const db = client.db("cliniq");

await db.collection("icd10_codes").bulkWrite(
  commonIcdCodes.map(([code, description, category]) => ({
    updateOne: {
      filter: { code },
      update: {
        $set: {
          code,
          description,
          category,
          chapter: null,
          is_billable: true,
          parent_code: null,
          is_common: true,
          updated_at: new Date().toISOString(),
        },
        $setOnInsert: {
          created_at: new Date().toISOString(),
        },
      },
      upsert: true,
    },
  }))
);

console.log(`Seeded ${commonIcdCodes.length} ICD-10 codes.`);
await client.close();
