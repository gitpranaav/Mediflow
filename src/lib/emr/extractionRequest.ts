import { EXTRACT_DELTA_SYSTEM_PROMPT, EXTRACT_FULL_SYSTEM_PROMPT } from "./extractDeltaPrompt";
import type { EMRSnapshot, TranscriptSegment } from "./types";

export const BASELINE_MODEL = "llama-3.3-70b-versatile";
export const BASELINE_PROMPT_VERSION = "baseline-v1";

/** Shared by the production routes and replay harness; preserves the baseline payload. */
export function buildDeltaExtractionRequest(body: {
  segments_delta: TranscriptSegment[];
  emr_snapshot?: EMRSnapshot | null;
  patient_allergies?: string[];
}) {
  return {
    model: BASELINE_MODEL,
    temperature: 0.05,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: EXTRACT_DELTA_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: JSON.stringify({
          segments_delta: body.segments_delta.map((s) => ({
            id: s.id, text: s.text, confidence: s.confidence ?? null,
            language: s.language ?? null, start_ms: s.start_ms ?? null, end_ms: s.end_ms ?? null,
          })),
          emr_snapshot: body.emr_snapshot ?? {},
          patient_allergies: Array.isArray(body.patient_allergies)
            ? body.patient_allergies.map((a) => String(a).trim()).filter(Boolean) : [],
        }),
      },
    ],
  };
}

export function buildFullExtractionRequest(body: { transcript_text?: string; patient_context?: unknown }) {
  return {
    model: BASELINE_MODEL,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: EXTRACT_FULL_SYSTEM_PROMPT },
      { role: "user" as const, content: JSON.stringify({
        transcript_text: body.transcript_text, patient_context: body.patient_context ?? {},
      }) },
    ],
    temperature: 0.05,
  };
}
