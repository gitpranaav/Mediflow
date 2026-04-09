import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";

import { PatientDetailTabs } from "@/src/components/doctor/PatientDetailTabs";
import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent } from "@/src/components/ui/Card";
import { getServerContext } from "@/src/lib/mongodb/server";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

interface PatientRecord {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  abha_id: string | null;
  phone: string | null;
  address: string | null;
}

function formatAge(dob: string | null) {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return `${Math.max(age, 0)} years`;
}

function normalizeMedicationNames(medications: unknown): string[] {
  if (!Array.isArray(medications)) return [];
  return medications
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item && typeof item.name === "string") return item.name;
      return "";
    })
    .filter(Boolean);
}

export default async function PatientDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const { db, session } = await getServerContext();
  const doctorObjectId = new ObjectId(session.uid);
  const patientObjectId = new ObjectId(id);
  const link = await db.collection("patient_doctors").findOne({ patient_id: patientObjectId, doctor_id: doctorObjectId });
  if (!link) notFound();

  const patient = await db.collection("patients").findOne({ _id: patientObjectId });
  const typedPatient = patient
    ? ({
        id: patient._id.toString(),
        name: patient.name,
        dob: patient.dob ?? null,
        gender: patient.gender ?? null,
        blood_group: patient.blood_group ?? null,
        allergies: patient.allergies ?? [],
        chronic_conditions: patient.chronic_conditions ?? [],
        abha_id: patient.abha_id ?? null,
        phone: patient.phone ?? null,
        address: patient.address ?? null,
      } as PatientRecord)
    : null;
  if (!typedPatient) notFound();

  const consultations = await db
    .collection("consultations")
    .find({ patient_id: patientObjectId, doctor_id: doctorObjectId })
    .sort({ created_at: -1 })
    .toArray();
  const consultationIds = consultations.map((c) => c._id);
  const emrEntries = consultationIds.length ? await db.collection("emr_entries").find({ consultation_id: { $in: consultationIds } }).toArray() : [];
  const prescriptions = consultationIds.length ? await db.collection("prescriptions").find({ consultation_id: { $in: consultationIds } }).toArray() : [];
  const emrEntryIds = emrEntries.map((e) => e._id);
  const diagnosesRows = emrEntryIds.length ? await db.collection("emr_diagnoses").find({ emr_entry_id: { $in: emrEntryIds } }).toArray() : [];
  const icdIds = diagnosesRows.map((d) => d.icd_code_id).filter(Boolean);
  const icdCodes = icdIds.length ? await db.collection("icd10_codes").find({ _id: { $in: icdIds } }).toArray() : [];
  const icdMap = new Map(icdCodes.map((code) => [code._id.toString(), code]));

  const diagnosisMap = new Map<string, Array<{ code: string; description: string }>>();
  for (const row of diagnosesRows as unknown as Array<{ emr_entry_id: ObjectId; icd_code_id?: ObjectId | null }>) {
    if (!row.icd_code_id) continue;
    const icd = icdMap.get(row.icd_code_id.toString());
    if (!icd) continue;
    const key = row.emr_entry_id.toString();
    const current = diagnosisMap.get(key) ?? [];
    current.push({ code: icd.code, description: icd.description });
    diagnosisMap.set(key, current);
  }

  const emrByConsultation = new Map(emrEntries.map((entry) => [entry.consultation_id.toString(), entry]));
  const prescriptionByConsultation = new Map<string, Array<{ medications: unknown }>>();
  for (const prescription of prescriptions as unknown as Array<{ consultation_id: ObjectId; medications: unknown }>) {
    const key = prescription.consultation_id.toString();
    const current = prescriptionByConsultation.get(key) ?? [];
    current.push({ medications: prescription.medications });
    prescriptionByConsultation.set(key, current);
  }

  const history = (consultations as Array<{
    _id: ObjectId;
    created_at: string;
  }>).map((consultation) => {
    const consultationId = consultation._id.toString();
    const emr = emrByConsultation.get(consultationId);
    const meds = (prescriptionByConsultation.get(consultationId) ?? []).flatMap((item) => normalizeMedicationNames(item.medications));
    return {
      consultationId,
      createdAt: consultation.created_at,
      chiefComplaint: emr?.chief_complaint ?? null,
      assessment: emr?.assessment ?? null,
      clinicalSummary: emr?.clinical_summary ?? null,
      diagnoses: emr ? diagnosisMap.get(emr._id.toString()) ?? [] : [],
      medications: meds,
    };
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-start gap-4">
              <Avatar size="lg" name={typedPatient.name} />
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-[hsl(var(--text-primary))]">{typedPatient.name}</h2>
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                {formatAge(typedPatient.dob)} · {typedPatient.gender ?? "—"} · Blood {typedPatient.blood_group ?? "—"}
              </p>
              <p className="text-sm text-[hsl(var(--text-secondary))]">ABHA ID: {typedPatient.abha_id ?? "Not available"}</p>
              <div className="flex flex-wrap gap-1">
                {(typedPatient.allergies ?? []).map((allergy) => (
                  <Badge key={allergy} variant="danger">
                    {allergy}
                  </Badge>
                ))}
                {(typedPatient.chronic_conditions ?? []).map((condition) => (
                  <Badge key={condition} variant="warning">
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PatientDetailTabs patient={typedPatient} history={history} />
    </div>
  );
}
