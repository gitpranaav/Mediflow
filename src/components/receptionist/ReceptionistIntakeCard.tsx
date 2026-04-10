"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";
import { Select } from "@/src/components/ui/Select";
import { consultationTypeOptions } from "@/src/lib/consultations/visitTypes";

const FOLLOW_NONE = "_none";

interface PriorConsultationOption {
  id: string;
  created_at: string;
  type: string;
  chief_complaint: string | null;
}

interface PatientOption {
  id: string;
  name: string;
}

interface ReceptionistIntakeCardProps {
  patients: PatientOption[];
}

export function ReceptionistIntakeCard({ patients }: ReceptionistIntakeCardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patientId, setPatientId] = useState<string>("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spo2, setSpo2] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [visitType, setVisitType] = useState("General");
  const [priorOptions, setPriorOptions] = useState<PriorConsultationOption[]>([]);
  const [followUpOfId, setFollowUpOfId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((patient) => patient.name.toLowerCase().includes(q));
  }, [patients, query]);

  const patientOptions = filtered.map((patient) => ({ value: patient.id, label: patient.name }));

  useEffect(() => {
    if (!patientId) {
      setPriorOptions([]);
      setFollowUpOfId("");
      return;
    }
    setFollowUpOfId("");
    setPriorOptions([]);
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/patients/${patientId}/consultations`);
      const data = (await res.json()) as { consultations?: PriorConsultationOption[] };
      if (cancelled) return;
      if (res.ok && Array.isArray(data.consultations)) setPriorOptions(data.consultations);
      else setPriorOptions([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const followUpSelectOptions = useMemo(() => {
    return [
      { value: FOLLOW_NONE, label: "None (new episode)" },
      ...priorOptions.map((c) => {
        const d = new Date(c.created_at);
        const dateLabel = Number.isNaN(d.getTime()) ? c.created_at : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const tail = c.chief_complaint?.trim() ? ` — ${c.chief_complaint.trim().slice(0, 48)}` : "";
        return { value: c.id, label: `${dateLabel} · ${c.type}${tail}` };
      }),
    ];
  }, [priorOptions]);

  function toNumber(value: string) {
    const n = Number(value);
    return Number.isFinite(n) && value.trim() !== "" ? n : null;
  }

  async function saveIntake() {
    setError(null);
    setSuccess(null);
    if (!patientId) {
      setError("Select a patient first.");
      return;
    }
    setLoading(true);
    try {
      const createRes = await fetch("/api/consultations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          type: visitType,
          chief_complaint: chiefComplaint.trim() || undefined,
          follow_up_of: followUpOfId.trim() || undefined,
        }),
      });
      const createData = (await createRes.json()) as { consultation_id?: string; error?: string };
      if (!createRes.ok || !createData.consultation_id) {
        setError(createData.error ?? "Could not start intake consultation.");
        return;
      }

      const snapshot = {
        chief_complaint: chiefComplaint.trim() || null,
        vitals: {
          bp_systolic: toNumber(bpSystolic),
          bp_diastolic: toNumber(bpDiastolic),
          heart_rate: toNumber(heartRate),
          temperature: toNumber(temperature),
          spo2: toNumber(spo2),
          weight: toNumber(weight),
          height: toNumber(height),
        },
      };

      const emrRes = await fetch(`/api/emr/by-consultation/${createData.consultation_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const emrData = (await emrRes.json()) as { error?: string };
      if (!emrRes.ok) {
        setError(emrData.error ?? "Consultation was created but intake details failed to save.");
        return;
      }

      await fetch(`/api/consultations/${createData.consultation_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_status: "done", intake_completed_at: new Date().toISOString() }),
      });

      setSuccess("Intake saved. Doctor can continue this consultation.");
      setChiefComplaint("");
      setBpSystolic("");
      setBpDiastolic("");
      setHeartRate("");
      setTemperature("");
      setSpo2("");
      setWeight("");
      setHeight("");
      router.refresh();
    } catch {
      setError("Failed to save intake details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reception Intake</CardTitle>
        <CardDescription>Capture vitals and chief complaint before doctor starts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          label="Search patient"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type patient name"
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[hsl(var(--text-secondary))]">Patient</p>
          <Select
            value={patientId}
            onValueChange={setPatientId}
            options={patientOptions}
            placeholder={patientOptions.length ? "Select patient" : "No patient matches search"}
          />
        </div>
        <Select value={visitType} onValueChange={setVisitType} options={consultationTypeOptions} placeholder="Visit type" />
        {patientId && priorOptions.length ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[hsl(var(--text-secondary))]">Follow-up of (optional)</p>
            <Select
              value={followUpOfId || FOLLOW_NONE}
              onValueChange={(v) => setFollowUpOfId(v === FOLLOW_NONE ? "" : v)}
              options={followUpSelectOptions}
              placeholder="Link to prior visit"
            />
          </div>
        ) : null}
        <Input
          label="Chief complaint"
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.target.value)}
          placeholder="Fever since 2 days"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input type="number" label="BP Systolic" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} />
          <Input type="number" label="BP Diastolic" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} />
          <Input type="number" label="Heart Rate" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
          <Input type="number" label="Temperature" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          <Input type="number" label="SpO2" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
          <Input type="number" label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <Input type="number" label="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}
        {success ? <p className="text-xs text-[hsl(var(--success))]">{success}</p> : null}
        <Button onClick={saveIntake} loading={loading}>
          Save Intake and Create Consultation
        </Button>
      </CardContent>
    </Card>
  );
}
