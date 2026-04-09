"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Badge } from "@/src/components/ui/Badge";

type ContextResponse = {
  doctor?: { specialty_code?: string; specialization?: string | null; name?: string | null } | null;
  patient?: { name?: string | null; phone?: string | null; dob?: string | null; gender?: string | null } | null;
  history?: any | null;
  specialty_history?: any | null;
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

function listOrDash(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  return value.map((x) => String(x)).join(", ");
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
            <p className="text-xs text-[hsl(var(--text-muted))]">Active meds</p>
            <p className="text-[hsl(var(--text-primary))]">{listOrDash(data?.history?.active_meds)}</p>
          </div>

          {data?.specialty_history ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary))] p-3">
              <p className="text-xs font-medium text-[hsl(var(--text-primary))]">{titleFromSpecialtyCode(data?.doctor?.specialty_code)}</p>
              {data?.doctor?.specialty_code === "gynec" ? (
                <div className="grid gap-2 sm:grid-cols-2">
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
              ) : (
                <pre className="overflow-auto rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-2 text-xs text-[hsl(var(--text-secondary))]">
                  {JSON.stringify(data.specialty_history, null, 2)}
                </pre>
              )}
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

