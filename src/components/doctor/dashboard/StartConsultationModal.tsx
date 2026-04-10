"use client";

import { Search, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/src/components/ui/Avatar";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Modal } from "@/src/components/ui/Modal";
import { Select } from "@/src/components/ui/Select";
import { consultationTypeOptions } from "@/src/lib/consultations/visitTypes";

const FOLLOW_NONE = "_none";

interface PatientOption {
  id: string;
  name: string;
  ageText: string;
  gender: string | null;
}

interface PriorConsultationOption {
  id: string;
  created_at: string;
  type: string;
  chief_complaint: string | null;
}

interface StartConsultationModalProps {
  doctorId: string;
  patients: PatientOption[];
}

export function StartConsultationModal({ doctorId, patients }: StartConsultationModalProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [consultationType, setConsultationType] = useState("General");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [priorOptions, setPriorOptions] = useState<PriorConsultationOption[]>([]);
  const [followUpOfId, setFollowUpOfId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) => patient.name.toLowerCase().includes(query));
  }, [patients, search]);

  useEffect(() => {
    if (!selectedPatientId) {
      setPriorOptions([]);
      setFollowUpOfId("");
      return;
    }
    setFollowUpOfId("");
    setPriorOptions([]);
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/patients/${selectedPatientId}/consultations`);
      const data = (await res.json()) as { consultations?: PriorConsultationOption[] };
      if (cancelled) return;
      if (res.ok && Array.isArray(data.consultations)) setPriorOptions(data.consultations);
      else setPriorOptions([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

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

  const startSession = async () => {
    if (!selectedPatientId) {
      setError("Please select a patient.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/consultations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: doctorId,
          patient_id: selectedPatientId,
          type: consultationType,
          chief_complaint: chiefComplaint.trim() || undefined,
          follow_up_of: followUpOfId.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { consultation_id?: string; error?: string };

      if (!response.ok || !result.consultation_id) {
        setError(result.error ?? "Failed to start consultation.");
        return;
      }

      setOpen(false);
      router.push(`/doctor/consultation/${result.consultation_id}`);
    } catch {
      setError("Unable to connect to create consultation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Start New Consultation"
      description="Search a patient and start a live session."
      trigger={
        <Button iconLeft={<Stethoscope className="h-4 w-4" />} size="md">
          Start New Consultation
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={startSession} loading={loading}>
            Start Session
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patient by name"
          iconLeft={<Search className="h-4 w-4" />}
        />

        <div className="max-h-56 space-y-2 overflow-auto rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] p-2">
          {filteredPatients.length ? (
            filteredPatients.map((patient) => {
              const selected = selectedPatientId === patient.id;
              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`flex w-full items-center gap-3 rounded-[calc(var(--radius)-4px)] border px-2.5 py-2 text-left transition-colors ${
                    selected
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.12)]"
                      : "border-transparent hover:bg-[hsl(var(--bg-secondary))]"
                  }`}
                >
                  <Avatar size="sm" name={patient.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[hsl(var(--text-primary))]">{patient.name}</p>
                    <p className="text-xs text-[hsl(var(--text-muted))]">
                      {patient.ageText}
                      {patient.gender ? ` · ${patient.gender}` : ""}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="px-1 py-2 text-sm text-[hsl(var(--text-muted))]">No patients found for this search.</p>
          )}
        </div>

        <Select value={consultationType} onValueChange={setConsultationType} options={consultationTypeOptions} />

        {selectedPatientId && priorOptions.length ? (
          <Select
            value={followUpOfId || FOLLOW_NONE}
            onValueChange={(v) => setFollowUpOfId(v === FOLLOW_NONE ? "" : v)}
            options={followUpSelectOptions}
            placeholder="Link to prior visit (optional)"
          />
        ) : null}

        <Input
          value={chiefComplaint}
          onChange={(event) => setChiefComplaint(event.target.value)}
          placeholder="Chief complaint (optional)"
        />

        {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}
      </div>
    </Modal>
  );
}
