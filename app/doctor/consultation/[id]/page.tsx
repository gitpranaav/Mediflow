import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";

import { ConsultationWorkspace } from "@/src/components/doctor/consultation/ConsultationWorkspace";
import { getServerContext } from "@/src/lib/mongodb/server";

type ConsultationPageProps = {
  params: Promise<{ id: string }>;
};

interface ConsultationRecord {
  id: string;
  type: string | null;
  started_at: string | null;
  patients?: { name: string } | null;
}

export default async function ConsultationPage({ params }: ConsultationPageProps) {
  const { id } = await params;
  const { db, session } = await getServerContext();
  const doctorObjectId = new ObjectId(session.uid);
  const consultationDoc = await db.collection("consultations").findOne({ _id: new ObjectId(id), doctor_id: doctorObjectId });
  if (!consultationDoc) notFound();
  const link = consultationDoc.patient_id
    ? await db.collection("patient_doctors").findOne({ patient_id: consultationDoc.patient_id, doctor_id: doctorObjectId })
    : null;
  if (consultationDoc.patient_id && !link) notFound();

  const patient = consultationDoc.patient_id ? await db.collection("patients").findOne({ _id: consultationDoc.patient_id }) : null;
  const consultation = {
    id: consultationDoc._id.toString(),
    type: consultationDoc.type ?? null,
    started_at: consultationDoc.started_at ?? null,
    patients: patient ? { name: patient.name } : null,
  } as ConsultationRecord;
  if (!consultation) notFound();

  return (
    <ConsultationWorkspace
      consultationId={consultation.id}
      patientName={consultation.patients?.name ?? "Unknown Patient"}
      consultationType={consultation.type ?? "General"}
      initialStartedAt={consultation.started_at}
    />
  );
}
