export const CONSULTATION_TYPE_VALUES = ["General", "Follow-up", "Emergency", "Teleconsult"] as const;

export type ConsultationTypeValue = (typeof CONSULTATION_TYPE_VALUES)[number];

export const consultationTypeOptions: Array<{ value: ConsultationTypeValue; label: string }> = [
  { value: "General", label: "General" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Emergency", label: "Emergency" },
  { value: "Teleconsult", label: "Teleconsult" },
];

export function normalizeConsultationType(value: unknown): ConsultationTypeValue {
  const s = typeof value === "string" ? value.trim() : "";
  return (CONSULTATION_TYPE_VALUES as readonly string[]).includes(s) ? (s as ConsultationTypeValue) : "General";
}
