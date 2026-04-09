"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Modal } from "@/src/components/ui/Modal";
import { Select } from "@/src/components/ui/Select";

interface FormState {
  name: string;
  dob: string;
  gender: string;
  blood_group: string;
  phone: string;
  allergies: string;
  chronic_conditions: string;
  address: string;
}

const initialState: FormState = {
  name: "",
  dob: "",
  gender: "",
  blood_group: "",
  phone: "",
  allergies: "",
  chronic_conditions: "",
  address: "",
};

const genderOptions = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => ({
  value,
  label: value,
}));

function toTagArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AddPatientModal() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialState);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) {
      setError("Patient name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/patients/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        dob: form.dob || null,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        phone: form.phone.trim(),
        allergies: toTagArray(form.allergies),
        chronic_conditions: toTagArray(form.chronic_conditions),
        address: form.address.trim() || null,
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to add patient.");
      return;
    }

    setSuccess("Patient added successfully.");
    setForm(initialState);
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError(null);
          setSuccess(null);
        }
      }}
      title="Add New Patient"
      description="Create a patient record for consultations."
      trigger={
        <Button iconLeft={<Plus className="h-4 w-4" />}>
          Add New Patient
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Save Patient
          </Button>
        </>
      }
      contentClassName="max-w-2xl"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Full Name*" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
        <Input label="Date of Birth" type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[hsl(var(--text-secondary))]">Gender</p>
          <Select value={form.gender} onValueChange={(value) => updateField("gender", value)} options={genderOptions} placeholder="Select gender" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-[hsl(var(--text-secondary))]">Blood Group</p>
          <Select
            value={form.blood_group}
            onValueChange={(value) => updateField("blood_group", value)}
            options={bloodGroupOptions}
            placeholder="Select blood group"
          />
        </div>
        <Input label="Phone*" placeholder="+91..." value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
        <Input
          label="Allergies (comma-separated)"
          placeholder="Penicillin, Dust"
          value={form.allergies}
          onChange={(e) => updateField("allergies", e.target.value)}
        />
        <Input
          label="Chronic Conditions (comma-separated)"
          placeholder="Diabetes, Hypertension"
          value={form.chronic_conditions}
          onChange={(e) => updateField("chronic_conditions", e.target.value)}
        />
        <Input label="Address" value={form.address} onChange={(e) => updateField("address", e.target.value)} />
      </div>
      {error ? <p className="mt-3 text-xs text-[hsl(var(--danger))]">{error}</p> : null}
      {success ? (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-[hsl(var(--success))]">
          <X className="h-3.5 w-3.5 rotate-45" />
          {success}
        </p>
      ) : null}
    </Modal>
  );
}
