import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createSessionToken, getSessionCookieName } from "@/src/lib/auth/session";
import { getUserByEmail } from "@/src/lib/mongodb/repo";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { doctor_email?: string; password?: string };
    const doctorEmail = body.doctor_email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!doctorEmail || !password) {
      return NextResponse.json({ error: "Doctor email and password are required." }, { status: 400 });
    }

    const doctor = await getUserByEmail(doctorEmail);
    if (!doctor || String(doctor.role ?? "doctor") !== "doctor") {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const hash = (doctor as any).receptionist_password_hash;
    if (!hash) {
      return NextResponse.json({ error: "Receptionist access is not enabled for this doctor." }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, String(hash));
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await createSessionToken({
      uid: doctor._id.toString(),
      email: String(doctor.email),
      role: "receptionist",
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 500 });
  }
}

