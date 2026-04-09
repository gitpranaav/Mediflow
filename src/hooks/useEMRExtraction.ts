"use client";

import { useState } from "react";

type Status = "idle" | "extracting" | "done" | "error";

export function useEMRExtraction() {
  const [status, setStatus] = useState<Status>("idle");
  const [emrData, setEmrData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const extract = async (payload: { consultation_id: string; transcript_text: string; patient_context?: unknown }) => {
    setStatus("extracting");
    setError(null);
    try {
      const res = await fetch("/api/emr/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setEmrData(data);
      setStatus("done");
      return data;
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Extraction failed");
      return null;
    }
  };

  return { extract, status, emrData, error };
}
