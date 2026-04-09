"use client";

import { Search, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/src/components/ui/Avatar";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Modal } from "@/src/components/ui/Modal";
import { Select } from "@/src/components/ui/Select";

interface PatientOption {
  id: string;
  name: string;
  ageText: string;
  gender: string | null;
}

interface StartConsultationModalProps {
  doctorId: string;
  patients: PatientOption[];
}

const consultationTypeOptions = [
  { value: "General", label: "General" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Emergency", label: "Emergency" },
  { value: "Teleconsult", label: "Teleconsult" },
];

export function StartConsultationModal({ doctorId, patients }: StartConsultationModalProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [consultationType, setConsultationType] = useState("General");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) => patient.name.toLowerCase().includes(query));
  }, [patients, search]);

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
