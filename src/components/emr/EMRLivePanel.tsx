"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { cn } from "@/src/lib/utils";
import { findAllergyMedicationWarnings } from "@/src/lib/clinical/allergyMedicationCheck";
import type { EMRMedication, EMRSnapshot } from "@/src/lib/emr/types";

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x ?? "").trim()).filter(Boolean);
}

const fieldWrap = "min-w-0 space-y-1";
const labelCls = "text-xs font-medium text-[hsl(var(--text-secondary))]";
const inputCls =
  "h-9 w-full min-w-0 rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] px-2.5 text-sm text-[hsl(var(--text-primary))] shadow-[var(--shadow-sm)] placeholder:text-[hsl(var(--text-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg-primary))]";
const textareaCls = cn(inputCls, "min-h-[4.5rem] resize-y py-2");

function emptyMedication(): EMRMedication {
  return {
    name: "",
    dosage: "",
    frequency: "",
    duration: "",
    route: "",
    instructions: "",
    icd10_code: "",
    icd10_description: "",
  };
}

type IcdHit = { id: string; code: string; description: string };

function MedicationIcdLookup({
  code,
  description,
  onPick,
  onClear,
}: {
  code: string;
  description: string;
  onPick: (hit: IcdHit) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<IcdHit[]>([]);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      if (!q.trim()) {
        setHits([]);
        return;
      }
      const res = await fetch(`/api/icd/search?q=${encodeURIComponent(q.trim())}&limit=8`);
      const data = await res.json();
      setHits(Array.isArray(data.codes) ? data.codes : []);
    }, 280);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-1.5 rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-primary))] p-2">
      <p className="text-[11px] font-medium text-[hsl(var(--text-muted))]">ICD-10 mapping (from database / search)</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={cn(inputCls, "max-w-xs flex-1 text-xs")}
          placeholder="Search code or diagnosis…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {code ? (
          <>
            <span className="font-mono text-xs text-[hsl(var(--accent))]">{code}</span>
            <span className="max-w-[220px] truncate text-xs text-[hsl(var(--text-primary))]" title={description}>
              {description || "—"}
            </span>
            <button type="button" className="text-xs text-[hsl(var(--danger))] underline" onClick={onClear}>
              Clear
            </button>
          </>
        ) : null}
      </div>
      {hits.length > 0 ? (
        <ul className="max-h-28 overflow-auto rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-xs">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-[hsl(var(--bg-secondary))]"
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                }}
              >
                <span className="font-mono text-[hsl(var(--accent))]">{h.code}</span>
                <span className="text-[hsl(var(--text-secondary))]"> — {h.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function EMRLivePanel({
  consultationId,
  snapshot,
  onChangeSnapshot,
  patientAllergies = [],
}: {
  consultationId: string;
  snapshot: EMRSnapshot;
  onChangeSnapshot: (next: EMRSnapshot) => void;
  /** Core allergies from patient history (for interaction warnings). */
  patientAllergies?: string[];
}) {
  const [saveText, setSaveText] = useState("Not saved yet");
  const [allergyBanner, setAllergyBanner] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const medications = snapshot.medications?.length ? snapshot.medications : [emptyMedication()];

  const payload = useMemo(() => ({ snapshot }), [snapshot]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const res = await fetch(`/api/emr/by-consultation/${consultationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaveText(res.ok ? `Saved ${new Date().toLocaleTimeString("en-IN")}` : "Save failed");
    }, 1200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [consultationId, payload]);

  const medSignature = useMemo(
    () =>
      (snapshot.medications ?? [])
        .map((m) => (m.name ?? "").trim().toLowerCase())
        .filter(Boolean)
        .join("|"),
    [snapshot.medications]
  );

  const allergyKey = patientAllergies.map((a) => String(a).trim().toLowerCase()).join("|");

  useEffect(() => {
    let hideTimer: number | null = null;
    const debounce = window.setTimeout(() => {
      const named = (snapshotRef.current.medications ?? []).filter((m) => (m.name ?? "").trim());
      const warnings = findAllergyMedicationWarnings(patientAllergies, named);
      if (!warnings.length) {
        setAllergyBanner(null);
        return;
      }
      setAllergyBanner(warnings.join(" · "));
      hideTimer = window.setTimeout(() => setAllergyBanner(null), 2000);
    }, 350);
    return () => {
      window.clearTimeout(debounce);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [medSignature, allergyKey, patientAllergies]);

  const setMeds = (next: EMRMedication[]) => {
    const cleaned = next.filter((m) => m.name?.trim());
    onChangeSnapshot({
      ...snapshot,
      medications: cleaned.length ? cleaned : [emptyMedication()],
    });
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-4 pb-1 text-[hsl(var(--text-secondary))]">
      {allergyBanner ? (
        <div
          className="shrink-0 rounded-[var(--radius)] border border-[hsl(var(--danger))] bg-[hsl(var(--danger)/0.12)] px-3 py-2 text-xs font-medium text-[hsl(var(--danger))]"
          role="alert"
        >
          {allergyBanner}
        </div>
      ) : null}

      {/* Vitals */}
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 shadow-[var(--shadow-sm)]">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">Vitals</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {(
            [
              ["bp_systolic", "BP systolic"],
              ["bp_diastolic", "BP diastolic"],
              ["heart_rate", "Heart rate"],
              ["spo2", "SpO₂ (%)"],
              ["temperature", "Temp (°C)"],
              ["weight", "Weight (kg)"],
              ["height", "Height (cm)"],
            ] as const
          ).map(([key, lbl]) => (
            <div key={key} className={fieldWrap}>
              <label className={labelCls} htmlFor={`vital-${key}`}>
                {lbl}
              </label>
              <input
                id={`vital-${key}`}
                type="number"
                className={inputCls}
                value={(snapshot.vitals?.[key] as number | null | undefined) ?? ""}
                onChange={(e) =>
                  onChangeSnapshot({
                    ...snapshot,
                    vitals: { ...(snapshot.vitals ?? {}), [key]: Number(e.target.value) || null },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* Clinical */}
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 shadow-[var(--shadow-sm)]">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">Clinical</h4>
        <div className="flex flex-col gap-3">
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="chief">
              Chief complaint
            </label>
            <textarea
              id="chief"
              className={textareaCls}
              rows={2}
              value={snapshot.chief_complaint ?? ""}
              onChange={(e) => onChangeSnapshot({ ...snapshot, chief_complaint: e.target.value })}
              placeholder="—"
            />
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="symptoms">
              Symptoms (comma-separated)
            </label>
            <input
              id="symptoms"
              className={inputCls}
              value={normalizeArray(snapshot.symptoms).join(", ")}
              onChange={(e) =>
                onChangeSnapshot({
                  ...snapshot,
                  symptoms: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="dx">
              Diagnosis (comma-separated)
            </label>
            <input
              id="dx"
              className={inputCls}
              value={normalizeArray(snapshot.diagnosis_text).join(", ")}
              onChange={(e) =>
                onChangeSnapshot({
                  ...snapshot,
                  diagnosis_text: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="labs">
              Lab tests ordered (comma-separated)
            </label>
            <input
              id="labs"
              className={inputCls}
              value={normalizeArray(snapshot.lab_tests_ordered).join(", ")}
              onChange={(e) =>
                onChangeSnapshot({
                  ...snapshot,
                  lab_tests_ordered: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Summaries */}
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 shadow-[var(--shadow-sm)]">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">Summaries</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="csum">
              Clinical summary
            </label>
            <textarea
              id="csum"
              className={textareaCls}
              rows={3}
              value={snapshot.clinical_summary ?? ""}
              onChange={(e) => onChangeSnapshot({ ...snapshot, clinical_summary: e.target.value })}
            />
          </div>
          <div className={fieldWrap}>
            <label className={labelCls} htmlFor="psum">
              Patient summary
            </label>
            <textarea
              id="psum"
              className={textareaCls}
              rows={3}
              value={snapshot.patient_summary ?? ""}
              onChange={(e) => onChangeSnapshot({ ...snapshot, patient_summary: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Medications */}
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 shadow-[var(--shadow-sm)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">Medications</h4>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            iconLeft={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setMeds([...medications, emptyMedication()])}
          >
            Add medication
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {medications.map((med, index) => (
            <div
              key={index}
              className="space-y-3 rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary)/0.4)] p-3"
            >
              <div className={fieldWrap}>
                <label className={labelCls}>Drug name</label>
                <input
                  className={inputCls}
                  value={med.name}
                  onChange={(e) => {
                    const next = [...medications];
                    next[index] = { ...next[index], name: e.target.value };
                    setMeds(next);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["dosage", "Dose"],
                    ["frequency", "Frequency"],
                    ["duration", "Duration"],
                    ["route", "Route"],
                  ] as const
                ).map(([field, lbl]) => (
                  <div key={field} className={fieldWrap}>
                    <label className={labelCls}>{lbl}</label>
                    <input
                      className={inputCls}
                      value={(med[field] as string) ?? ""}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], [field]: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className={fieldWrap}>
                <label className={labelCls}>Instructions</label>
                <input
                  className={inputCls}
                  value={med.instructions ?? ""}
                  onChange={(e) => {
                    const next = [...medications];
                    next[index] = { ...next[index], instructions: e.target.value };
                    setMeds(next);
                  }}
                />
              </div>
              <MedicationIcdLookup
                code={med.icd10_code ?? ""}
                description={med.icd10_description ?? ""}
                onPick={(hit) => {
                  const next = [...medications];
                  next[index] = {
                    ...next[index],
                    icd10_code: hit.code,
                    icd10_description: hit.description,
                  };
                  setMeds(next);
                }}
                onClear={() => {
                  const next = [...medications];
                  next[index] = { ...next[index], icd10_code: "", icd10_description: "" };
                  setMeds(next);
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[hsl(var(--danger))]"
                  iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    const next = medications.filter((_, i) => i !== index);
                    setMeds(next.length ? next : [emptyMedication()]);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Needs confirmation */}
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 shadow-[var(--shadow-sm)]">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">
          Needs confirmation
        </h4>
        {(snapshot.needs_confirmation?.length ?? 0) > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {snapshot.needs_confirmation!.map((path) => (
              <li
                key={path}
                className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--accent)/0.08)] px-2.5 py-0.5 text-xs text-[hsl(var(--text-primary))]"
              >
                {path}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[hsl(var(--text-muted))]">—</p>
        )}
      </section>

      <div className="flex shrink-0 items-center justify-between border-t border-[hsl(var(--border))] pt-3">
        <p className="text-xs text-[hsl(var(--text-muted))]">{saveText}</p>
        <Button variant="secondary" size="sm" className="h-8" onClick={() => onChangeSnapshot({})}>
          Clear EMR
        </Button>
      </div>
    </div>
  );
}
