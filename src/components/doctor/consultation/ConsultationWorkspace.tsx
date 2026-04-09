"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { EMRLivePanel } from "@/src/components/emr/EMRLivePanel";
import { STTRecorder } from "@/src/components/stt/STTRecorder";
import { TranscriptViewer } from "@/src/components/stt/TranscriptViewer";
import { PatientHistoryPanel } from "@/src/components/history/PatientHistoryPanel";
import { useSTT } from "@/src/hooks/useSTT";
import type { EMRSnapshot, TranscriptSegment } from "@/src/lib/emr/types";

interface WorkspaceProps {
  consultationId: string;
  patientName: string;
  consultationType: string;
  initialStartedAt: string | null;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function ConsultationWorkspace({
  consultationId,
  patientName,
  consultationType,
  initialStartedAt,
}: WorkspaceProps) {
  const [syncText, setSyncText] = useState("Sync pending");
  const [patientAllergies, setPatientAllergies] = useState<string[]>([]);
  const [emrSnapshot, setEmrSnapshot] = useState<EMRSnapshot>({});
  const [cursor, setCursor] = useState<{ last_final_segment_id?: string | null; last_final_index?: number | null } | null>(null);
  const extractingRef = useRef(false);
  const emrSnapshotRef = useRef<EMRSnapshot>({});
  const cursorRef = useRef<typeof cursor>(null);
  emrSnapshotRef.current = emrSnapshot;
  cursorRef.current = cursor;

  const stt = useSTT({ consultationId });

  const startedAt = useMemo(
    () => new Date(initialStartedAt ?? new Date().toISOString()),
    [initialStartedAt]
  );
  const [elapsed, setElapsed] = useState(
    Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000))
  );

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/consultations/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
      setSyncText(response.ok ? `Synced ${new Date().toLocaleTimeString("en-IN")}` : "Status sync failed");
    }, 30000);
    return () => clearInterval(interval);
  }, [consultationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/emr/by-consultation/${consultationId}`, { method: "GET" });
      const data = await res.json();
      if (cancelled) return;
      if (res.ok && data?.emr_entry?.snapshot) setEmrSnapshot(data.emr_entry.snapshot);
      if (res.ok && data?.emr_entry?.extraction_cursor) setCursor(data.emr_entry.extraction_cursor);
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/consultations/context/${consultationId}`);
      const data = await res.json();
      if (cancelled) return;
      const list = data?.history?.allergies;
      if (res.ok && Array.isArray(list)) {
        setPatientAllergies(list.map((x: unknown) => String(x).trim()).filter(Boolean));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  useEffect(() => {
    // Auto delta extraction when new final segments arrive (refs avoid resetting the debounce on every EMR update)
    const finalSegments = (stt.segments ?? []).filter((s: any) => s?.is_final) as TranscriptSegment[];
    if (!finalSegments.length) return;

    const c = cursorRef.current;
    const lastProcessedId = c?.last_final_segment_id ?? null;
    const startIndex = lastProcessedId ? finalSegments.findIndex((s) => s.id === lastProcessedId) + 1 : 0;
    const delta = startIndex >= 0 ? finalSegments.slice(startIndex) : finalSegments;

    if (!delta.length) return;
    if (extractingRef.current) return;

    extractingRef.current = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/emr/extract-delta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultation_id: consultationId,
            segments_delta: delta,
            emr_snapshot: emrSnapshotRef.current,
            cursor: cursorRef.current,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          if (data?.snapshot) setEmrSnapshot(data.snapshot);
          if (data?.new_cursor) setCursor(data.new_cursor);
        }
      } finally {
        extractingRef.current = false;
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [consultationId, stt.segments]);

  const endConsultation = async () => {
    // Persist latest transcript before finalize
    if (stt.fullText?.trim()) {
      await fetch("/api/transcripts/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultation_id: consultationId,
          raw_text: stt.fullText,
          segments: stt.segments,
          processing_status: "completed",
        }),
      });
    }

    // Final full-context extraction pass (optional but improves summary quality).
    if (stt.fullText?.trim()) {
      await fetch("/api/emr/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultation_id: consultationId, transcript_text: stt.fullText }),
      });
    }
    await fetch(`/api/consultations/${consultationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", ended_at: new Date().toISOString() }),
    });
    const emrRes = await fetch(`/api/emr/by-consultation/${consultationId}`, { method: "GET" });
    const emrJson = await emrRes.json();
    if (emrRes.ok && emrJson?.emr_entry?.snapshot) setEmrSnapshot(emrJson.emr_entry.snapshot);
    setSyncText("Consultation finalized");
  };

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[480px] flex-col gap-2">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm text-[hsl(var(--text-muted))]">Patient</p>
            <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">{patientName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">{consultationType}</Badge>
            <Badge variant="outline">
              <Clock3 className="mr-1 h-3.5 w-3.5" />
              {formatElapsed(elapsed)}
            </Badge>
            <Button variant="danger" onClick={endConsultation}>
              End Consultation
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.85fr)]">
        <Card className="flex min-h-0 min-w-0 flex-col lg:min-h-[240px] xl:min-h-0">
          <CardHeader className="shrink-0 py-2 pb-1">
            <CardTitle className="text-sm">STT + Transcript</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto px-3 pb-3 pt-0 text-sm text-[hsl(var(--text-secondary))]">
            <div className="space-y-3">
              <STTRecorder status={stt.status} error={stt.error} onStart={stt.start} onStop={stt.stop} onPause={stt.pause} onResume={stt.resume} />
              <TranscriptViewer segments={stt.segments as any} interimText={stt.interimText} />
            </div>
          </CardContent>
        </Card>
        <Card className="flex min-h-0 min-w-0 flex-col lg:min-h-[320px] xl:min-h-0">
          <CardHeader className="shrink-0 py-2 pb-1">
            <CardTitle className="text-sm">Live EMR</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-0">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] xl:overflow-y-auto">
              <EMRLivePanel
                consultationId={consultationId}
                snapshot={emrSnapshot}
                onChangeSnapshot={setEmrSnapshot}
                patientAllergies={patientAllergies}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-2 xl:col-span-1">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PatientHistoryPanel consultationId={consultationId} />
          </div>
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--text-muted))]">{syncText}</p>
    </div>
  );
}
