/**
 * Backfill consultations missing follow_up_of (MongoDB is schemaless; older docs may omit the key).
 * Safe to run multiple times. Does not overwrite existing ObjectId links.
 */
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const client = new MongoClient(uri);
await client.connect();
const db = client.db("cliniq");

const result = await db.collection("consultations").updateMany(
  { follow_up_of: { $exists: false } },
  { $set: { follow_up_of: null } }
);

console.log("Backfill follow_up_of on consultations:");
console.log(`  matched: ${result.matchedCount}, modified: ${result.modifiedCount}`);

await client.close();
