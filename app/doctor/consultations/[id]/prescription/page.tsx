import Image from "next/image";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";

import { PrescriptionPrintButton } from "@/src/components/doctor/consultation/PrescriptionPrintButton";
import { Card } from "@/src/components/ui/Card";
import { getServerContext } from "@/src/lib/mongodb/server";

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[,.;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCountNearPhrase(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = text.match(new RegExp(`(?:^|\\s)(\\d+)\\s*(?:tab|tablet|cap|capsule|ml|drop|drops)?\\s*(?:-)?\\s*(?:before|after)?\\s*${escaped}(?:$|\\s)`));
  if (direct?.[1]) return Number(direct[1]) || 1;

  const reverse = text.match(new RegExp(`${escaped}\\s*(?:-)?\\s*(\\d+)\\b`));
  if (reverse?.[1]) return Number(reverse[1]) || 1;

  return 1;
}

function inferDoseNotation(med: any): string | null {
  const combined = normalizeText(`${clean(med?.frequency)} ${clean(med?.instructions)}`);
  if (!combined) return null;

  const explicit = combined.match(/\b(\d+)\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)\b/);
  if (explicit) return `${explicit[1]}-${explicit[2]}-${explicit[3]}`;

  let morning = 0;
  let afternoon = 0;
  let night = 0;

  if (/breakfast|morning|after waking/.test(combined)) {
    morning = extractCountNearPhrase(combined, "breakfast");
  }
  if (/lunch|afternoon|noon/.test(combined)) {
    afternoon = extractCountNearPhrase(combined, "lunch");
  }
  if (/dinner|night|bedtime|evening/.test(combined)) {
    night = extractCountNearPhrase(combined, "dinner");
  }

  if (morning || afternoon || night) {
    return `${morning}-${afternoon}-${night}`;
  }

  if (/once (a )?day|once daily|daily once|od\b/.test(combined)) return "1-0-0";
  if (/twice (a )?day|twice daily|bid\b/.test(combined)) return "1-0-1";
  if (/thrice (a )?day|three times (a )?day|tid\b/.test(combined)) return "1-1-1";

  return null;
}

async function fetchPrescriptionData(id: string) {
  const { db, session } = await getServerContext();
  const doctorObjectId = new ObjectId(session.uid);

  const [consultation, doctor] = await Promise.all([
    db.collection("consultations").findOne({ _id: new ObjectId(id), doctor_id: doctorObjectId }),
    db.collection("users").findOne({ _id: doctorObjectId }),
  ]);

  if (!consultation) return null;

  const [patient, emrEntry] = await Promise.all([
    consultation.patient_id ? db.collection("patients").findOne({ _id: consultation.patient_id, doctor_id: doctorObjectId }) : null,
    db.collection("emr_entries").findOne({ consultation_id: consultation._id }),
  ]);

  const snapshot = emrEntry?.snapshot ?? {};

  return {
    consultation,
    patient,
    doctor,
    snapshot,
  };
}

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchPrescriptionData(id);
  if (!data) notFound();

  const clinicName = clean(data.doctor?.clinic_name) || "Clinic / Hospital Name";
  const clinicAddress = clean(data.doctor?.clinic_address);
  const clinicPhone = clean(data.doctor?.clinic_phone);
  const registrationNumber = clean(data.doctor?.registration_number);
  const doctorName = clean(data.doctor?.doctor_name) || clean(data.doctor?.name) || "Doctor";
  const diagnosisList = Array.isArray(data.snapshot?.diagnosis_text) ? data.snapshot.diagnosis_text.map((item: unknown) => clean(item)).filter(Boolean) : [];
  const diagnosis = diagnosisList[0] || clean(data.snapshot?.chief_complaint) || "Diagnosis";
  const diagnosisIcd = Array.isArray(data.snapshot?.diagnosis_icd) ? data.snapshot.diagnosis_icd : [];
  const medications = Array.isArray(data.snapshot?.medications) ? data.snapshot.medications : [];

  return (
    <div className="mx-auto max-w-5xl bg-[hsl(var(--bg-primary))] px-4 py-4 text-[hsl(var(--text-primary))] print:max-w-none print:px-0 print:py-0">
      <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
        <PrescriptionPrintButton />
      </div>

      <Card className="overflow-hidden border-[1.5px] border-black/20 bg-white text-black shadow-none print:border-0">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4 border-b border-black/20 pb-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-black/20 bg-white">
              <Image src="/caduceus.svg" alt="Caduceus" width={48} height={48} className="h-12 w-12 object-contain" priority />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-2xl font-semibold uppercase tracking-wide">{clinicName}</div>
              {clinicAddress ? <div className="mt-1 text-sm">{clinicAddress}</div> : null}
              <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                {clinicPhone ? <span>Phone: {clinicPhone}</span> : null}
                {registrationNumber ? <span>Reg. No: {registrationNumber}</span> : null}
              </div>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-black/20 text-3xl font-semibold text-[hsl(var(--accent))]">
              ℞
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3 text-sm">
            <div>
              <div className="font-semibold">Patient: {clean(data.patient?.name) || "Unknown"}</div>
              <div>Age / Sex: {clean(data.patient?.age) || ""}{clean(data.patient?.gender) ? ` / ${clean(data.patient?.gender)}` : ""}</div>
            </div>
            <div className="text-right">
              <div>Date: {formatDate(data.consultation.ended_at ?? data.consultation.created_at)}</div>
              <div>Consultation ID: {String(data.consultation._id)}</div>
            </div>
          </div>

          <div className="mt-4 border-t border-black/20 pt-3">
            <div className="text-sm font-semibold uppercase tracking-wide">Diagnosis</div>
            <div className="mt-1 text-base font-semibold">{diagnosis}</div>
            {diagnosisIcd.length > 0 ? (
              <div className="mt-1 text-sm text-black/70">
                {diagnosisIcd
                  .map((item: any) => `${clean(item.icd10_code)}${clean(item.icd10_description) ? ` - ${clean(item.icd10_description)}` : ""}`)
                  .filter(Boolean)
                  .join("; ")}
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t border-black/20 pt-3">
            <div className="text-sm font-semibold uppercase tracking-wide">Prescription</div>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/20 text-left">
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-2 font-semibold">Medicine</th>
                  <th className="py-2 pr-2 font-semibold">Dosage</th>
                  <th className="py-2 pr-2 font-semibold">Timing</th>
                  <th className="py-2 pr-2 font-semibold">Duration</th>
                  <th className="py-2 pr-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((med: any, index: number) => (
                  (() => {
                    const notation = inferDoseNotation(med);
                    return (
                      <tr key={`${clean(med.name)}-${index}`} className="border-b border-black/10 align-top">
                        <td className="py-2 pr-2">{index + 1}</td>
                        <td className="py-2 pr-2 font-semibold uppercase">{clean(med.name)}</td>
                        <td className="py-2 pr-2">
                          {notation ? <div className="font-semibold tracking-wide">{notation}</div> : null}
                          <div>{clean(med.dosage) || "-"}</div>
                        </td>
                        <td className="py-2 pr-2">{clean(med.frequency) || "-"}</td>
                        <td className="py-2 pr-2">{clean(med.duration) || "-"}</td>
                        <td className="py-2 pr-2">{[clean(med.route), clean(med.instructions)].filter(Boolean).join(" - ") || "-"}</td>
                      </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-black/20 pt-3 sm:grid-cols-2">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide">Advice</div>
              <div className="mt-1 text-sm">Take medicines as prescribed. Complete the ordered tests and return for review if symptoms worsen.</div>
            </div>
            <div className="text-right">
              <div className="mt-8 text-sm font-semibold">{doctorName}</div>
              <div className="text-sm">Signature / Stamp</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
