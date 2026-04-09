import { NextResponse } from "next/server";
import { getDb } from "@/src/lib/mongodb/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? "10");
  if (!q) return NextResponse.json({ codes: [] });

  const db = await getDb();
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const codes = await db
    .collection("icd10_codes")
    .find({ $or: [{ code: regex }, { description: regex }] })
    .limit(limit)
    .toArray()
    .then((rows) =>
      rows.map((row) => ({
        id: row._id.toString(),
        code: row.code,
        description: row.description,
        category: row.category ?? null,
        is_billable: row.is_billable ?? null,
        is_common: row.is_common ?? false,
      }))
    );

  if (codes.length >= 3) return NextResponse.json({ codes });

  try {
    const nihUrl = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(q)}&maxList=${limit}`;
    const fallback = await fetch(nihUrl);
    const fallbackData = (await fallback.json()) as any[];
    const rows = Array.isArray(fallbackData?.[3]) ? fallbackData[3] : [];
    const mapped = rows.map((row: [string, string]) => ({
      id: row[0],
      code: row[0],
      description: row[1],
      category: null,
      is_billable: null,
      is_common: false,
    }));
    return NextResponse.json({ codes: [...codes, ...mapped].slice(0, limit) });
  } catch {
    return NextResponse.json({ codes });
  }
}
