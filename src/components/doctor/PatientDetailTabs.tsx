"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";

interface PatientInfo {
  name: string;
  gender: string | null;
  blood_group: string | null;
  allergies: string[] | null;
  chronic_conditions: string[] | null;
  abha_id: string | null;
  phone: string | null;
  address: string | null;
}

interface HistoryItem {
  consultationId: string;
  createdAt: string;
  visitType: string;
  status: string | null;
  followUpOfId: string | null;
  followUpOfLabel: string | null;
  chiefComplaint: string | null;
  assessment: string | null;
  clinicalSummary: string | null;
  diagnoses: Array<{ code: string; description: string }>;
  medications: string[];
}

interface DetailTabsProps {
  patient: PatientInfo;
  history: HistoryItem[];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function visitTypeBadgeVariant(t: string): "danger" | "warning" | "info" | "outline" {
  if (t === "Emergency") return "danger";
  if (t === "Follow-up") return "warning";
  if (t === "Teleconsult") return "info";
  return "outline";
}

export function PatientDetailTabs({ patient, history }: DetailTabsProps) {
  const [tab, setTab] = useState<"overview" | "history" | "medications">("overview");

  const allMeds = useMemo(() => {
    const rows: Array<{ consultationId: string; createdAt: string; medication: string }> = [];
    for (const item of history) {
      for (const med of item.medications) {
        rows.push({ consultationId: item.consultationId, createdAt: item.createdAt, medication: med });
      }
    }
    return rows;
  }, [history]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="inline-flex rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] p-0.5">
          {[
            { id: "overview", label: "Overview" },
            { id: "history", label: "Consultation History" },
            { id: "medications", label: "Medications" },
          ].map((item) => (
            <button
              key={item.id}
              className={`rounded-[calc(var(--radius)-4px)] px-3 py-1.5 text-sm ${
                tab === item.id ? "bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]"
              }`}
              onClick={() => setTab(item.id as typeof tab)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {tab === "overview" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-3">
              <p className="text-xs text-[hsl(var(--text-muted))]">Emergency Contact</p>
              <p className="mt-1 text-sm text-[hsl(var(--text-primary))]">{patient.phone ?? "Not provided"}</p>
            </div>
            <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-3">
              <p className="text-xs text-[hsl(var(--text-muted))]">Address</p>
              <p className="mt-1 text-sm text-[hsl(var(--text-primary))]">{patient.address ?? "Not provided"}</p>
            </div>
            <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-3">
              <p className="text-xs text-[hsl(var(--text-muted))]">Last Assessment</p>
              <p className="mt-1 text-sm text-[hsl(var(--text-primary))]">{history[0]?.assessment ?? "No assessments yet"}</p>
            </div>
            <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-3">
              <p className="text-xs text-[hsl(var(--text-muted))]">Last Clinical Summary</p>
              <p className="mt-1 text-sm text-[hsl(var(--text-primary))]">{history[0]?.clinicalSummary ?? "No summary yet"}</p>
            </div>
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="space-y-3">
            {history.length ? (
              history.map((item) => (
                <details key={item.consultationId} className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{formatDate(item.createdAt)}</p>
                        <Badge variant={visitTypeBadgeVariant(item.visitType)}>{item.visitType}</Badge>
                        {item.status ? <Badge variant="outline">{item.status}</Badge> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-[hsl(var(--text-muted))]">{item.chiefComplaint ?? "—"}</p>
                        <Link
                          href={`/doctor/consultation/${item.consultationId}`}
                          className="text-xs font-medium text-[hsl(var(--accent))] underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open visit
                        </Link>
                      </div>
                    </div>
                    {item.followUpOfId ? (
                      <p className="mt-2 text-xs text-[hsl(var(--text-muted))]">
                        Follow-up of {item.followUpOfLabel ?? `visit ${item.followUpOfId.slice(0, 8)}…`}
                      </p>
                    ) : null}
                  </summary>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-[hsl(var(--text-secondary))]">
                      <span className="font-medium text-[hsl(var(--text-primary))]">Assessment:</span> {item.assessment ?? "Not recorded"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {item.diagnoses.map((diagnosis) => (
                        <Badge key={`${item.consultationId}-${diagnosis.code}`} variant="outline">
                          {diagnosis.code} - {diagnosis.description}
                        </Badge>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-[hsl(var(--text-primary))]">Prescribed medications</p>
                      {item.medications.length ? (
                        item.medications.map((medication) => (
                          <p key={`${item.consultationId}-${medication}`} className="text-[hsl(var(--text-secondary))]">
                            - {medication}
                          </p>
                        ))
                      ) : (
                        <p className="text-[hsl(var(--text-muted))]">No medications recorded.</p>
                      )}
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <p className="text-sm text-[hsl(var(--text-muted))]">No consultation history found.</p>
            )}
          </div>
        ) : null}

        {tab === "medications" ? (
          <div className="space-y-2">
            {allMeds.length ? (
              allMeds.map((item) => (
                <div key={`${item.consultationId}-${item.medication}`} className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-3">
                  <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{item.medication}</p>
                  <p className="text-xs text-[hsl(var(--text-muted))]">Consultation: {formatDate(item.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[hsl(var(--text-muted))]">No medications have been prescribed yet.</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
