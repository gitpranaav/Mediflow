"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { cn } from "@/src/lib/utils";
import { findAllergyMedicationWarnings } from "@/src/lib/clinical/allergyMedicationCheck";
import type { EMRDiagnosisIcd, EMRMedication, EMRSnapshot } from "@/src/lib/emr/types";

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
  compact = false,
}: {
  code: string;
  description: string;
  onPick: (hit: IcdHit) => void;
  onClear: () => void;
  compact?: boolean;
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
    <div className={cn("space-y-1.5 rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-primary))] p-2", compact && "space-y-1 p-1.5")}>
      {!compact ? <p className="text-[11px] font-medium text-[hsl(var(--text-muted))]">ICD-10 mapping (from database / search)</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={cn(inputCls, "max-w-xs flex-1 text-xs", compact && "h-8 px-2")}
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
        <ul className={cn("max-h-28 overflow-auto rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-xs", compact && "max-h-24")}>
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
  liveAllergyAlert,
}: {
  consultationId: string;
  snapshot: EMRSnapshot;
  onChangeSnapshot: (next: EMRSnapshot) => void;
  /** Core allergies from patient history (for interaction warnings). */
  patientAllergies?: string[];
  /** Real-time alert generated from live transcript mentions. */
  liveAllergyAlert?: string | null;
}) {
  const [saveText, setSaveText] = useState("Not saved yet");
  const [allergyBanner, setAllergyBanner] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const onChangeRef = useRef(onChangeSnapshot);
  onChangeRef.current = onChangeSnapshot;

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
    const debounce = window.setTimeout(() => {
      const named = (snapshotRef.current.medications ?? []).filter((m) => (m.name ?? "").trim());
      const warnings = findAllergyMedicationWarnings(patientAllergies, named);
      setAllergyBanner(warnings.length ? warnings.join(" · ") : null);
    }, 350);
    return () => window.clearTimeout(debounce);
  }, [medSignature, allergyKey, patientAllergies]);

  const diagnosisItems = useMemo(
    () => normalizeArray(snapshot.diagnosis_text),
    [snapshot.diagnosis_text]
  );

  const diagnosisIcdSig = useMemo(() => {
    const rows = (snapshot.diagnosis_icd ?? []).map(
      (row) => `${(row.diagnosis ?? "").trim().toLowerCase()}|${(row.icd10_code ?? "").trim()}`
    );
    return `${diagnosisItems.join("|")}::${rows.join(";;")}`;
  }, [diagnosisItems, snapshot.diagnosis_icd]);

  useEffect(() => {
    if (!diagnosisItems.length) {
      if ((snapshotRef.current.diagnosis_icd ?? []).length) {
        onChangeRef.current({ ...snapshotRef.current, diagnosis_icd: [] });
      }
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(async () => {
      const s2 = snapshotRef.current;
      const current = s2.diagnosis_icd ?? [];
      const byDiagnosis = new Map(current.map((row) => [String(row.diagnosis ?? "").trim().toLowerCase(), row]));
      const nextRows: EMRDiagnosisIcd[] = [];
      let changed = false;

      for (const diagnosis of diagnosisItems) {
        const key = diagnosis.trim().toLowerCase();
        const existing = byDiagnosis.get(key);
        if (existing) {
          nextRows.push({ ...existing, diagnosis });
          continue;
        }

        if (cancelled) return;
        let hit: IcdHit | undefined;
        const res = await fetch(`/api/icd/search?q=${encodeURIComponent(diagnosis)}&limit=1`);
        const data = (await res.json()) as { codes?: IcdHit[] };
        if (data.codes?.[0]) hit = data.codes[0];

        nextRows.push({
          diagnosis,
          icd10_code: hit?.code ?? "",
          icd10_description: hit?.description ?? "",
          confidence: hit ? "low" : undefined,
        });
        changed = true;
      }

      const removedStale = current.length !== nextRows.length;
      if (changed || removedStale) {
        onChangeRef.current({ ...s2, diagnosis_icd: nextRows });
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [diagnosisIcdSig, diagnosisItems]);

  const setMeds = (next: EMRMedication[]) => {
    const cleaned = next.filter((m) => m.name?.trim());
    onChangeSnapshot({
      ...snapshot,
      medications: cleaned.length ? cleaned : [emptyMedication()],
    });
  };

  const combinedAllergyBanner = [liveAllergyAlert, allergyBanner].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-3 pb-1 text-[hsl(var(--text-secondary))]">
      {combinedAllergyBanner ? (
        <div
          className="shrink-0 rounded-[var(--radius)] border border-[hsl(var(--danger))] bg-[hsl(var(--danger)/0.12)] px-3 py-2 text-xs font-medium text-[hsl(var(--danger))]"
          role="alert"
        >
          {combinedAllergyBanner}
        </div>
      ) : null}
      {patientAllergies.length ? (
        <div
          className="shrink-0 rounded-[var(--radius)] border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.08)] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]"
          role="status"
        >
          <span className="font-semibold text-[hsl(var(--text-primary))]">Allergies on file: </span>
          {patientAllergies.join(", ")}
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
              rows={2}
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
              rows={2}
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
        <div className="overflow-x-auto rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))]">
          <table className="min-w-[980px] w-full text-xs">
            <thead className="bg-[hsl(var(--bg-secondary)/0.55)] text-[hsl(var(--text-muted))]">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">Drug</th>
                <th className="px-2 py-2 text-left font-semibold">Dose</th>
                <th className="px-2 py-2 text-left font-semibold">Frequency</th>
                <th className="px-2 py-2 text-left font-semibold">Duration</th>
                <th className="px-2 py-2 text-left font-semibold">Route</th>
                <th className="px-2 py-2 text-left font-semibold">Instructions</th>
                <th className="w-12 px-2 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((med, index) => (
                <tr key={index} className="border-t border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]">
                  <td className="p-2 align-top">
                    <input
                      className={cn(inputCls, "h-8 min-w-[150px] px-2 text-xs")}
                      value={med.name}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], name: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      className={cn(inputCls, "h-8 min-w-[92px] px-2 text-xs")}
                      value={med.dosage ?? ""}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], dosage: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      className={cn(inputCls, "h-8 min-w-[130px] px-2 text-xs")}
                      value={med.frequency ?? ""}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], frequency: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      className={cn(inputCls, "h-8 min-w-[92px] px-2 text-xs")}
                      value={med.duration ?? ""}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], duration: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      className={cn(inputCls, "h-8 min-w-[82px] px-2 text-xs")}
                      value={med.route ?? ""}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], route: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <input
                      className={cn(inputCls, "h-8 min-w-[220px] px-2 text-xs")}
                      value={med.instructions ?? ""}
                      onChange={(e) => {
                        const next = [...medications];
                        next[index] = { ...next[index], instructions: e.target.value };
                        setMeds(next);
                      }}
                    />
                  </td>
                  <td className="p-2 text-right align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[hsl(var(--danger))]"
                      iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => {
                        const next = medications.filter((_, i) => i !== index);
                        setMeds(next.length ? next : [emptyMedication()]);
                      }}
                      aria-label="Remove medication"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ICD-10 mapping */}
      <section className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 shadow-[var(--shadow-sm)]">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-muted))]">ICD-10 mapping</h4>
        <div className="flex flex-col gap-2">
          {diagnosisItems.length > 0 ? (
            diagnosisItems
              .map((diagnosis, index) => {
                const row = (snapshot.diagnosis_icd ?? []).find(
                  (item) => String(item.diagnosis ?? "").trim().toLowerCase() === diagnosis.trim().toLowerCase()
                );
                return { diagnosis, index, row };
              })
              .map(({ diagnosis, index, row }) => (
                <div key={`icd-${index}`} className="rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary)/0.35)] p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[hsl(var(--text-primary))]">{diagnosis}</p>
                    {row?.confidence === "low" && row?.icd10_code ? (
                      <p className="text-[10px] text-[hsl(var(--text-muted))]">Auto-mapped, verify</p>
                    ) : null}
                  </div>
                  <MedicationIcdLookup
                    compact
                    code={row?.icd10_code ?? ""}
                    description={row?.icd10_description ?? ""}
                    onPick={(hit) => {
                      const s2 = snapshotRef.current;
                      const existing = [...(s2.diagnosis_icd ?? [])];
                      const idx = existing.findIndex(
                        (item) => String(item.diagnosis ?? "").trim().toLowerCase() === diagnosis.trim().toLowerCase()
                      );
                      const nextRow: EMRDiagnosisIcd = {
                        diagnosis,
                        icd10_code: hit.code,
                        icd10_description: hit.description,
                        confidence: undefined,
                      };
                      if (idx >= 0) existing[idx] = nextRow;
                      else existing.push(nextRow);
                      onChangeSnapshot({ ...s2, diagnosis_icd: existing });
                    }}
                    onClear={() => {
                      const s2 = snapshotRef.current;
                      const existing = [...(s2.diagnosis_icd ?? [])];
                      const idx = existing.findIndex(
                        (item) => String(item.diagnosis ?? "").trim().toLowerCase() === diagnosis.trim().toLowerCase()
                      );
                      const nextRow: EMRDiagnosisIcd = {
                        diagnosis,
                        icd10_code: "",
                        icd10_description: "",
                        confidence: undefined,
                      };
                      if (idx >= 0) existing[idx] = nextRow;
                      else existing.push(nextRow);
                      onChangeSnapshot({ ...s2, diagnosis_icd: existing });
                    }}
                  />
                </div>
              ))
          ) : (
            <p className="text-xs text-[hsl(var(--text-muted))]">Add diagnosis text to manage ICD-10 mapping.</p>
          )}
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
