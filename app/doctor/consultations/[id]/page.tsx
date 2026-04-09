import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { getServerContext } from "@/src/lib/mongodb/server";

async function fetchConsultation(id: string) {
  const { db, session } = await getServerContext();
  const doctorObjectId = new ObjectId(session.uid);
  const consultation = await db.collection("consultations").findOne({ _id: new ObjectId(id), doctor_id: doctorObjectId });
  if (!consultation) return null;
  const [patient, transcript, emrEntry] = await Promise.all([
    consultation.patient_id ? db.collection("patients").findOne({ _id: consultation.patient_id, doctor_id: doctorObjectId }) : null,
    db.collection("transcripts").findOne({ consultation_id: consultation._id }),
    db.collection("emr_entries").findOne({ consultation_id: consultation._id }),
  ]);
  return {
    ...consultation,
    patients: patient,
    transcripts: transcript ? [transcript] : [],
    emr_entries: emrEntry ? [emrEntry] : [],
  };
}

export default async function ConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = (await fetchConsultation(id)) as any;
  if (!data) notFound();

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader><CardTitle>Consultation Review</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Patient:</strong> {data.patients?.name ?? "Unknown"}</p>
          <p><strong>Date:</strong> {new Date(data.created_at).toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> {data.status}</p>
          <p><strong>Clinical summary:</strong> {data.emr_entries?.[0]?.clinical_summary ?? "N/A"}</p>
          <details>
            <summary className="cursor-pointer">Transcript</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm">{data.transcripts?.[0]?.raw_text ?? "No transcript"}</p>
          </details>
          <Button variant="secondary">Export PDF (step 15 hook ready)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
