import type { Db } from "mongodb";

/** First local DB match for auto-ICD (regex on code or description). */
export async function findFirstIcdMatch(db: Db, raw: string): Promise<{ code: string; description: string } | null> {
  const q = raw.trim();
  if (q.length < 2) return null;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");
  const row = await db.collection("icd10_codes").findOne({ $or: [{ code: regex }, { description: regex }] });
  if (!row || typeof row.code !== "string") return null;
  return { code: row.code, description: String(row.description ?? "") };
}
