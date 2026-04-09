import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getServerSession } from "@/src/lib/auth/session";
import { getDb } from "@/src/lib/mongodb/client";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const payload = (await request.json()) as Record<string, unknown>;
  const role = String(session.role);
  if (role === "receptionist") {
    return NextResponse.json({ error: "Receptionist cannot update EMR entry directly." }, { status: 403 });
  }
  const db = await getDb();
  await db.collection("emr_entries").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...payload,
        updated_by: new ObjectId(session.uid),
        updated_by_role: role,
        updated_at: new Date().toISOString(),
      },
    }
  );
  return NextResponse.json({ ok: true });
}
