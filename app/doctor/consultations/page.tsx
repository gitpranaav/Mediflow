import Link from "next/link";
import { ObjectId } from "mongodb";

import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { getServerContext } from "@/src/lib/mongodb/server";

export default async function ConsultationsPage() {
  const { db, session } = await getServerContext();
  const rows = await db
    .collection("consultations")
    .find({ doctor_id: new ObjectId(session.uid) })
    .sort({ created_at: -1 })
    .toArray();
  const patientIds = rows.map((row) => row.patient_id).filter(Boolean);
  const consultationIds = rows.map((row) => row._id);
  const doctorObjectId = new ObjectId(session.uid);
  const [patients, emrEntries] = await Promise.all([
    patientIds.length ? db.collection("patients").find({ _id: { $in: patientIds }, doctor_id: doctorObjectId }).toArray() : [],
    consultationIds.length ? db.collection("emr_entries").find({ consultation_id: { $in: consultationIds } }).toArray() : [],
  ]);
  const patientMap = new Map(patients.map((patient) => [patient._id.toString(), patient]));
  const emrMap = new Map(emrEntries.map((entry) => [entry.consultation_id.toString(), entry]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultation History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <Link key={row._id.toString()} href={`/doctor/consultations/${row._id.toString()}`} className="block rounded-[var(--radius)] border border-[hsl(var(--border))] p-3 hover:bg-[hsl(var(--bg-secondary))]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{patientMap.get(row.patient_id?.toString())?.name ?? "Unknown Patient"}</p>
              <Badge variant="outline">{row.status}</Badge>
            </div>
            <p className="text-xs text-[hsl(var(--text-muted))]">{new Date(row.created_at).toLocaleString("en-IN")} · {row.type ?? "General"}</p>
            <p className="text-sm">{emrMap.get(row._id.toString())?.chief_complaint ?? "No chief complaint"}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
