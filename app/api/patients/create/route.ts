import { NextResponse } from "next/server";

import { getServerSession } from "@/src/lib/auth/session";
import { ensurePatientDoctorLink, createOrUpdatePatientByPhone } from "@/src/lib/mongodb/repo";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["doctor", "receptionist"].includes(String(session.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body?.name || !body?.phone) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const patientId = await createOrUpdatePatientByPhone({
    name: String(body.name).trim(),
    dob: body.dob || null,
    gender: body.gender || null,
    blood_group: body.blood_group || null,
    phone: String(body.phone).trim(),
    allergies: Array.isArray(body.allergies) ? body.allergies : [],
    chronic_conditions: Array.isArray(body.chronic_conditions) ? body.chronic_conditions : [],
    address: body.address || null,
  });
  if (!patientId) return NextResponse.json({ error: "Could not create patient" }, { status: 500 });

  await ensurePatientDoctorLink(patientId, session.uid);

  return NextResponse.json({ id: patientId });
}
