"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";

type HistoryPayload = {
  id?: string;
  patient_id?: string;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  allergies?: unknown;
  problem_list?: unknown;
  past_surgeries?: unknown;
  family_history?: unknown;
  social_history?: unknown;
  immunizations?: unknown;
  active_meds?: unknown;
} | null;

type ContextResponse = {
  doctor?: { specialty_code?: string; specialization?: string | null; name?: string | null } | null;
  patient?: { name?: string | null; phone?: string | null; dob?: string | null; gender?: string | null } | null;
  history?: HistoryPayload;
  specialty_history?: { lmp?: string; g_p_a_l?: string; cycle_history?: string; [key: string]: unknown } | null;
  latest_consultation?: {
    consultation_id?: string;
    created_at?: string;
    visit_type?: string | null;
    status?: string | null;
    chief_complaint?: string | null;
    assessment?: string | null;
    clinical_summary?: string | null;
    patient_summary?: string | null;
    diagnoses?: Array<{ diagnosis_text?: string | null; icd_code_id?: string | null; is_primary?: boolean }>;
    medications?: unknown;
  } | null;
  recent?: Array<{ created_at: string; clinical_summary: string | null }> | null;
};

function titleFromSpecialtyCode(value: string | undefined) {
  if (!value) return "Specialty history";
  return `${value.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())} history`;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string | Date | null | undefined) {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function listOrDash(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  return value.map((x) => String(x)).join(", ");
}

function textOrDash(value: unknown) {
  if (value == null) return "—";
  const s = String(value).trim();
  return s.length ? s : "—";
}

function fieldLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase());
}

function omitSpecialtyKeys(entry: Record<string, unknown>) {
  const blocked = new Set(["lmp", "g_p_a_l", "cycle_history", "created_at", "updated_at", "patient_id", "doctor_id", "specialty_code", "_id"]);
  return Object.entries(entry).filter(([key, value]) => !blocked.has(key) && value != null && String(value).trim().length > 0);
}

function normalizeMedicationLabel(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const med = value as { name?: unknown; dosage?: unknown; frequency?: unknown; duration?: unknown; route?: unknown };
  const parts = [med.name, med.dosage, med.frequency, med.duration, med.route]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return parts.join(" · ");
}

export function PatientHistoryPanel({ consultationId }: { consultationId: string }) {
  const [data, setData] = useState<ContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(`/api/consultations/context/${consultationId}`);
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) setError(json.error ?? "Failed to load history");
      else setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Patient History</CardTitle>
            {data?.doctor?.specialty_code ? <Badge variant="outline">{data.doctor.specialty_code}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}

          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium text-[hsl(var(--text-primary))]">Core history</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Allergies</p>
            <p className="text-[hsl(var(--text-primary))]">{listOrDash(data?.history?.allergies)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Problem list</p>
            <p className="text-[hsl(var(--text-primary))]">{listOrDash(data?.history?.problem_list)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Past surgeries</p>
            <p className="text-[hsl(var(--text-primary))]">{listOrDash(data?.history?.past_surgeries)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Family history</p>
            <p className="whitespace-pre-wrap text-[hsl(var(--text-primary))]">{textOrDash(data?.history?.family_history)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Social history</p>
            <p className="whitespace-pre-wrap text-[hsl(var(--text-primary))]">{textOrDash(data?.history?.social_history)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Immunizations</p>
            <p className="text-[hsl(var(--text-primary))]">{listOrDash(data?.history?.immunizations)}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-[hsl(var(--text-muted))]">Active meds</p>
            <p className="text-[hsl(var(--text-primary))]">{listOrDash(data?.history?.active_meds)}</p>
          </div>

          {data?.history?.id ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary))] p-3">
              <p className="text-xs font-medium text-[hsl(var(--text-primary))]">Record</p>
              <div className="grid gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">History id</p>
                  <p className="break-all font-mono text-[hsl(var(--text-secondary))]">{data.history.id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Patient id</p>
                  <p className="break-all font-mono text-[hsl(var(--text-secondary))]">{data.history.patient_id ?? "—"}</p>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">Created</p>
                    <p className="text-[hsl(var(--text-secondary))]">{formatDateTime(data.history.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">Updated</p>
                    <p className="text-[hsl(var(--text-secondary))]">{formatDateTime(data.history.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {data?.specialty_history ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary))] p-3">
              <p className="text-xs font-medium text-[hsl(var(--text-primary))]">{titleFromSpecialtyCode(data?.doctor?.specialty_code)}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Last consultation</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.specialty_history?.last_consultation_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Last diagnosis</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.specialty_history?.last_diagnosis)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Diagnoses</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{listOrDash(data.specialty_history?.diagnoses)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Active meds</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{listOrDash(data.specialty_history?.active_meds)}</p>
                </div>
              </div>

              {data?.doctor?.specialty_code === "gynec" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">LMP</p>
                    <p className="text-sm text-[hsl(var(--text-primary))]">{data?.specialty_history?.lmp ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">G/P/A/L</p>
                    <p className="text-sm text-[hsl(var(--text-primary))]">{data?.specialty_history?.g_p_a_l ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">Cycle history</p>
                    <p className="text-sm text-[hsl(var(--text-primary))]">{data?.specialty_history?.cycle_history ?? "—"}</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {omitSpecialtyKeys(data.specialty_history as Record<string, unknown>).map(([key, value]) => (
                  <div key={key} className="rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-2">
                    <p className="text-[10px] text-[hsl(var(--text-muted))]">{fieldLabel(key)}</p>
                    <p className="whitespace-pre-wrap text-[hsl(var(--text-primary))]">{Array.isArray(value) ? listOrDash(value) : textOrDash(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {data?.latest_consultation ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary))] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[hsl(var(--text-primary))]">Latest consultation</p>
                {data.latest_consultation.visit_type ? <Badge variant="outline">{data.latest_consultation.visit_type}</Badge> : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Date</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{formatDateTime(data.latest_consultation.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Status</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.latest_consultation.status)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Chief complaint</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.latest_consultation.chief_complaint)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Assessment</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.latest_consultation.assessment)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Clinical summary</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.latest_consultation.clinical_summary)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Patient summary</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">{textOrDash(data.latest_consultation.patient_summary)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Diagnoses</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">
                    {listOrDash((data.latest_consultation.diagnoses ?? []).map((item) => item.diagnosis_text ?? ""))}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-[hsl(var(--text-muted))]">Medications</p>
                  <p className="text-sm text-[hsl(var(--text-primary))]">
                    {listOrDash((Array.isArray(data.latest_consultation.medications) ? data.latest_consultation.medications : []).map((item) => normalizeMedicationLabel(item)))}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-[hsl(var(--text-primary))]">Recent summaries</p>
            <div className="space-y-2">
              {(data?.recent ?? []).length ? (
                (data?.recent ?? []).map((row, idx) => (
                  <div key={`${row.created_at}-${idx}`} className="rounded-[var(--radius)] border border-[hsl(var(--border))] p-2">
                    <p className="text-xs text-[hsl(var(--text-muted))]">{formatDate(row.created_at)}</p>
                    <p className="text-sm text-[hsl(var(--text-primary))]">{row.clinical_summary ?? "No summary"}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[hsl(var(--text-muted))]">No recent summaries.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

