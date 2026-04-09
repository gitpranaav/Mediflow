import type { ReactNode } from "react";
import { ObjectId } from "mongodb";

import { DoctorShell } from "@/src/components/doctor/DoctorShell";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { getServerContext } from "@/src/lib/mongodb/server";

export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const { db, session } = await getServerContext();
  const doctor = await db
    .collection("users")
    .findOne({ _id: new ObjectId(session.uid) }, { projection: { name: 1, specialization: 1 } });
  const doctorName = String((doctor as any)?.name ?? "Doctor");
  const doctorSpecialization = String((doctor as any)?.specialization ?? "General Physician");

  return (
    <DoctorShell doctorName={doctorName} doctorSpecialization={doctorSpecialization}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DoctorShell>
  );
}
