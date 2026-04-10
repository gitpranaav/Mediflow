import type { ObjectId } from "mongodb";

export type Confidence = "high" | "medium" | "low";

export type EMRVitals = {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  weight?: number | null;
  height?: number | null;
};

export type EMRMedication = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  instructions?: string | null;
  /** Indication / billing ICD-10 mapped from local DB search */
  icd10_code?: string | null;
  icd10_description?: string | null;
  confidence?: Confidence;
};

export type EMRDiagnosisIcd = {
  diagnosis: string;
  icd10_code?: string | null;
  icd10_description?: string | null;
  confidence?: Confidence;
};

export type EMRSnapshot = {
  vitals?: EMRVitals;
  chief_complaint?: string | null;
  symptoms?: string[];
  diagnosis_text?: string[];
  diagnosis_icd?: EMRDiagnosisIcd[];
  medications?: EMRMedication[];
  lab_tests_ordered?: string[];
  clinical_summary?: string | null;
  patient_summary?: string | null;
  needs_confirmation?: string[];
};

export type EMROp =
  | { op: "set_fact"; path: string; value: unknown; confidence?: Confidence; evidence_segment_ids?: string[] }
  | { op: "update_fact"; path: string; value: unknown; confidence?: Confidence; evidence_segment_ids?: string[] }
  | { op: "retract_fact"; path: string; evidence_segment_ids?: string[] }
  | { op: "mark_uncertain"; path: string; note?: string; evidence_segment_ids?: string[] };

export type ExtractionCursor = {
  last_final_segment_id?: string | null;
  last_final_index?: number | null;
};

export type TranscriptSegment = {
  id: string;
  text: string;
  confidence?: number;
  is_final?: boolean;
  start_ms?: number;
  end_ms?: number;
  language?: string | null;
  timestamp?: string;
  speaker?: string;
};

export type EMREntryDoc = {
  _id: ObjectId;
  consultation_id: ObjectId;
  snapshot?: EMRSnapshot;
  extraction_cursor?: ExtractionCursor;
  provenance?: Record<string, unknown>;
  requires_review?: boolean;
  created_at: string;
  updated_at: string;
};

