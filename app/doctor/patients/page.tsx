import { PatientsClient } from "@/src/components/doctor/PatientsClient";
import { getServerContext } from "@/src/lib/mongodb/server";
import { ObjectId } from "mongodb";

interface PatientListRow {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  phone: string | null;
  abha_id: string | null;
  chronic_conditions: string[] | null;
  last_consultation_at: string | null;
}

interface ConsultationLite {
  patient_id: string;
  created_at: string;
}

export default async function PatientsPage() {
  const { db, session } = await getServerContext();
  const doctorObjectId = new ObjectId(session.uid);

  const [links, consultations] = await Promise.all([
    db.collection("patient_doctors").find({ doctor_id: doctorObjectId }).sort({ created_at: -1 }).toArray(),
    db
      .collection("consultations")
      .find({ doctor_id: doctorObjectId })
      .sort({ created_at: -1 })
      .project({ patient_id: 1, created_at: 1 })
      .toArray(),
  ]);

  const patientIds = (links ?? []).map((link: any) => link.patient_id).filter(Boolean);
  const patients = patientIds.length ? await db.collection("patients").find({ _id: { $in: patientIds } }).toArray() : [];

  const patientRows = (patients ?? []).map((patient: any) => ({
    id: patient._id.toString(),
    name: patient.name,
    dob: patient.dob ?? null,
    gender: patient.gender ?? null,
    blood_group: patient.blood_group ?? null,
    phone: patient.phone ?? null,
    abha_id: patient.abha_id ?? null,
    chronic_conditions: patient.chronic_conditions ?? [],
  })) as Omit<PatientListRow, "last_consultation_at">[];
  const consultationRows = (consultations ?? []).map((row: any) => ({
    patient_id: row.patient_id?.toString() ?? "",
    created_at: row.created_at,
  })) as ConsultationLite[];

  const latestByPatient = new Map<string, string>();
  for (const row of consultationRows) {
    if (!latestByPatient.has(row.patient_id)) {
      latestByPatient.set(row.patient_id, row.created_at);
    }
  }

  const enriched: PatientListRow[] = patientRows.map((patient) => ({
    ...patient,
    last_consultation_at: latestByPatient.get(patient.id) ?? null,
  }));

  return <PatientsClient patients={enriched} />;
}
