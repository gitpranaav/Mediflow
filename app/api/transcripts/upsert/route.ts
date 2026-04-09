import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.consultation_id) {
    return NextResponse.json({ error: "consultation_id is required" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("transcripts").updateOne(
    { consultation_id: new ObjectId(body.consultation_id) },
    {
      $set: {
        raw_text: body.raw_text ?? "",
        segments: Array.isArray(body.segments) ? body.segments : [],
        processing_status: body.processing_status ?? "in_progress",
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: {
        consultation_id: new ObjectId(body.consultation_id),
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
