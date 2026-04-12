import Link from "next/link";
import { CalendarDays, Clock3, Users } from "lucide-react";

import { ConsultationSparkline } from "@/src/components/doctor/dashboard/ConsultationSparkline";
import { StartConsultationModal } from "@/src/components/doctor/dashboard/StartConsultationModal";
import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { ObjectId } from "mongodb";

import { getServerContext } from "@/src/lib/mongodb/server";

interface ConsultationRow {
  id: string;
  patient_id: string;
  status: string;
  created_at: string;
  type: string | null;
  patients?: {
    name: string;
    dob: string | null;
    gender: string | null;
  } | null;
  emr_entries?: {
    chief_complaint: string | null;
  }[] | null;
}

interface WeekConsultationRow {
  patient_id: string;
  created_at: string;
}

interface PatientModalRow {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
}

function startOfDay(date = new Date()) {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

function endOfDay(date = new Date()) {
  const output = new Date(date);
  output.setHours(23, 59, 59, 999);
  return output;
}

function formatAgeText(dob: string | null) {
  if (!dob) return "Age unavailable";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "Age unavailable";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return `${Math.max(age, 0)} yrs`;
}

function dateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

export default async function DoctorDashboardPage() {
  const { db, session } = await getServerContext();
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const doctorObjectId = new ObjectId(session.uid);
  const doctorId = session.uid;

  const [todayAppointments, activeConsultations, weekRows, scheduleRows, recentRows, links, doctor] = await Promise.all([
    db.collection("consultations").countDocuments({
      doctor_id: doctorObjectId,
      created_at: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() },
    }),
    db.collection("consultations").countDocuments({ doctor_id: doctorObjectId, status: "active" }),
    db.collection("consultations").find({ doctor_id: doctorObjectId, created_at: { $gte: weekStart.toISOString() } }).project({ patient_id: 1, created_at: 1 }).toArray(),
    db.collection("consultations").find({
      doctor_id: doctorObjectId,
      created_at: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() },
    }).sort({ created_at: 1 }).toArray(),
    db.collection("consultations").find({ doctor_id: doctorObjectId }).sort({ created_at: -1 }).limit(24).toArray(),
    db.collection("patient_doctors").find({ doctor_id: doctorObjectId }).project({ patient_id: 1 }).toArray(),
    db.collection("users").findOne({ _id: doctorObjectId }, { projection: { name: 1, specialization: 1 } }),
  ]);

  const consultationPatientIds = Array.from(
    new Set([...scheduleRows, ...recentRows].map((row) => row.patient_id?.toString()).filter(Boolean) as string[])
  );
  const consultationIds = scheduleRows.map((row) => row._id);

  const linkedPatientIds = Array.from(
    new Set((links ?? []).map((row: any) => row.patient_id?.toString()).filter(Boolean) as string[])
  );
  const modalPatientIds = Array.from(
    new Set([...consultationPatientIds, ...linkedPatientIds])
  ).map((id) => new ObjectId(id));

  const [patientDocs, emrDocs] = await Promise.all([
    modalPatientIds.length ? db.collection("patients").find({ _id: { $in: modalPatientIds } }).toArray() : [],
    consultationIds.length
      ? db.collection("emr_entries").find({ consultation_id: { $in: consultationIds } }).project({ consultation_id: 1, chief_complaint: 1 }).toArray()
      : [],
  ]);

  const patientMap = new Map(patientDocs.map((p) => [p._id.toString(), p]));
  const emrMap = new Map(emrDocs.map((e) => [e.consultation_id.toString(), e]));

  const typedWeekRows = (weekRows ?? []).map((row: any) => ({
    patient_id: row.patient_id?.toString() ?? "",
    created_at: row.created_at,
  })) as WeekConsultationRow[];
  const typedPatientsForModal = (patientDocs ?? []).map((patient: any) => ({
    id: patient._id.toString(),
    name: patient.name,
    dob: patient.dob ?? null,
    gender: patient.gender ?? null,
  })) as PatientModalRow[];

  const weekPatientSet = new Set(typedWeekRows.map((row) => row.patient_id));
  const patientsThisWeek = weekPatientSet.size;

  const pointsMap = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    pointsMap.set(dateKey(d), 0);
  }
  for (const row of typedWeekRows) {
    const key = dateKey(new Date(row.created_at));
    if (pointsMap.has(key)) {
      pointsMap.set(key, (pointsMap.get(key) ?? 0) + 1);
    }
  }
  const weeklyChartData = Array.from(pointsMap.entries()).map(([key, count]) => {
    const d = new Date(key);
    return {
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      count,
    };
  });

  const schedule = (scheduleRows as any[]).map((row) => {
    const patient = patientMap.get(row.patient_id?.toString() ?? "");
    return {
    id: row._id.toString(),
    patientName: patient?.name ?? "Unknown Patient",
    ageText: formatAgeText(patient?.dob ?? null),
    chiefComplaint: emrMap.get(row._id.toString())?.chief_complaint ?? "General follow-up",
    gender: patient?.gender ?? null,
    status: row.status,
    type: row.type ?? "General",
    createdAt: row.created_at,
    };
  });

  const recentPatientsMap = new Map<
    string,
    { id: string; name: string; ageText: string; gender: string | null; lastVisit: string; primaryCondition: string }
  >();
  for (const row of recentRows ?? []) {
    const patientId = row.patient_id?.toString();
    if (!patientId) continue;
    const patient = patientMap.get(patientId);
    if (recentPatientsMap.has(patientId) || !patient?.name) continue;
    recentPatientsMap.set(patientId, {
      id: patientId,
      name: patient.name,
      ageText: formatAgeText(patient.dob ?? null),
      gender: patient.gender ?? null,
      lastVisit: new Date(row.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      primaryCondition: "Condition to be added",
    });
    if (recentPatientsMap.size >= 6) break;
  }
  const recentPatients = Array.from(recentPatientsMap.values());

  const now = new Date();
  const doctorName = String((doctor as any)?.name ?? "Doctor");

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">{doctorName}</h2>
          <p className="text-xs text-[hsl(var(--text-muted))]">
            {now.toLocaleDateString("en-IN", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today&apos;s Appointments</CardDescription>
            <CardTitle className="text-2xl">{todayAppointments}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-[hsl(var(--text-muted))]">
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
            Consultations scheduled today
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Consultations</CardDescription>
            <CardTitle className="text-2xl">{activeConsultations}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-[hsl(var(--text-muted))]">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            In-progress sessions right now
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Patients This Week</CardDescription>
            <CardTitle className="text-2xl">{patientsThisWeek}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-[hsl(var(--text-muted))]">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            Unique patients in last 7 days
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Consultations This Week</CardTitle>
            <CardDescription>Daily trend snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <ConsultationSparkline data={weeklyChartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start a consultation in one flow</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <StartConsultationModal
              doctorId={doctorId}
              patients={typedPatientsForModal.map((patient) => ({
                id: patient.id,
                name: patient.name,
                ageText: formatAgeText(patient.dob),
                gender: patient.gender,
              }))}
            />
            <Link href="#today-schedule">
              <Button variant="secondary">View Today&apos;s Schedule</Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section id="today-schedule">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Schedule</CardTitle>
            <CardDescription>Click a consultation to open the live workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedule.length ? (
              schedule.map((item) => (
                <Link
                  key={item.id}
                  href={`/doctor/consultation/${item.id}`}
                  className="flex flex-col gap-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 transition-colors hover:bg-[hsl(var(--bg-secondary))] md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="md" name={item.patientName} />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{item.patientName}</p>
                      <p className="text-xs text-[hsl(var(--text-muted))]">
                        {item.ageText}
                        {item.gender ? ` · ${item.gender}` : ""} · {item.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="max-w-52 truncate text-xs text-[hsl(var(--text-secondary))]">{item.chiefComplaint}</p>
                    <Badge variant={item.status === "active" ? "success" : item.status === "completed" ? "info" : "outline"}>
                      {item.status}
                    </Badge>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] p-8 text-center">
                <p className="text-sm font-medium text-[hsl(var(--text-primary))]">No consultations scheduled for today</p>
                <p className="mt-1 text-xs text-[hsl(var(--text-muted))]">Start a new session using Quick Actions.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent Patients</CardTitle>
            <CardDescription>Most recently consulted patients</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recentPatients.length ? (
              recentPatients.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/doctor/patients/${patient.id}`}
                  className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 transition-colors hover:bg-[hsl(var(--bg-secondary))]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={patient.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(var(--text-primary))]">{patient.name}</p>
                      <p className="text-xs text-[hsl(var(--text-muted))]">
                        {patient.ageText}
                        {patient.gender ? ` · ${patient.gender}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-[hsl(var(--text-secondary))]">
                    <p>Last visit: {patient.lastVisit}</p>
                    <p>Primary condition: {patient.primaryCondition}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--text-muted))]">
                Recent patients will appear after consultations are created.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
