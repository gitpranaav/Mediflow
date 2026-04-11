"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type STTStatus = "idle" | "requesting_permission" | "connecting" | "recording" | "paused";
export type STTSpeaker = "doctor" | "patient";

export interface STTSegment {
  id: string;
  text: string;
  speaker?: STTSpeaker;
  timestamp: string;
  confidence: number;
  is_final: boolean;
  start_ms?: number;
  end_ms?: number;
  language?: string | null;
}

interface UseSTTArgs {
  consultationId?: string;
  transcriptId?: string;
  chunkMs?: number;
}

type DeepgramResultMessage = {
  type?: string;
  is_final?: boolean;
  start?: number;
  duration?: number;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
    }>;
  };
  metadata?: {
    language?: string;
  };
};

export function useSTT({ consultationId, transcriptId, chunkMs = 250 }: UseSTTArgs = {}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentSpeakerRef = useRef<STTSpeaker>("doctor");

  const [status, setStatus] = useState<STTStatus>("idle");
  const [segments, setSegments] = useState<STTSegment[]>([]);
  const [interimText, setInterimText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const fullText = useMemo(() => segments.filter((s) => s.is_final).map((s) => s.text).join(" ").trim(), [segments]);

  const persistTranscript = useCallback(
    async (processingStatus: "in_progress" | "paused" | "completed") => {
      if (!consultationId) return;
      await fetch("/api/transcripts/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transcriptId ?? crypto.randomUUID(),
          consultation_id: consultationId,
          raw_text: fullText,
          segments,
          processing_status: processingStatus,
        }),
      });
    },
    [consultationId, fullText, segments, transcriptId]
  );

  const cleanup = useCallback(() => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    mediaRecorderRef.current = null;
    streamRef.current = null;
    wsRef.current = null;
    setInterimText("");
  }, []);

  const getDeepgramToken = useCallback(async () => {
    const res = await fetch("/api/stt/token", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to get token");
    return { token: String(data.token ?? ""), mode: String(data.mode ?? "") };
  }, []);

  const start = useCallback(async () => {
    if (!consultationId) {
      setError("Missing consultationId");
      return;
    }
    if (status !== "idle") return;

    try {
      setError(null);
      setStatus("requesting_permission");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      setStatus("connecting");
      const auth = await getDeepgramToken();

      const params = new URLSearchParams({
        model: "nova-3",
        punctuate: "true",
        smart_format: "true",
        interim_results: "true",
        // Hindi/Hinglish primary; Deepgram still performs reasonably on code-mix.
        language: "hi",
        endpointing: "300",
      });
      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
      // Match the working project: subprotocol auth, no tokens in URL.
      const ws = new WebSocket(wsUrl, ["token", auth.token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("recording");

        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
        });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
        recorder.start(chunkMs);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as DeepgramResultMessage;
          if (data?.type !== "Results") return;
          const alt = data.channel?.alternatives?.[0];
          const text = String(alt?.transcript ?? "").trim();
          if (!text) return;

          if (data.metadata?.language) setDetectedLanguage(data.metadata.language);

          const isFinal = Boolean(data.is_final);
          if (!isFinal) {
            setInterimText(text);
            return;
          }

          const startMs = typeof data.start === "number" ? Math.round(data.start * 1000) : undefined;
          const endMs =
            typeof data.start === "number" && typeof data.duration === "number"
              ? Math.round((data.start + data.duration) * 1000)
              : undefined;

          setSegments((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              text,
              speaker: currentSpeakerRef.current,
              confidence: typeof alt?.confidence === "number" ? alt.confidence : 0,
              timestamp: new Date().toISOString(),
              is_final: true,
              start_ms: startMs,
              end_ms: endMs,
              language: detectedLanguage,
            },
          ]);
          setInterimText("");
        } catch {
          // ignore non-json or unexpected
        }
      };

      ws.onerror = () => {
        // Browser doesn’t expose handshake status here.
        setError("STT connection error (websocket handshake failed)");
        setStatus("idle");
        cleanup();
      };

      ws.onclose = (e) => {
        // Deepgram often provides a useful reason string here (e.g., auth failure)
        const code = typeof e?.code === "number" ? e.code : null;
        const reason = e?.reason ? String(e.reason) : "";
        if (reason) setError(`STT closed (${code ?? "?"}): ${reason}`);
        else if (code != null) setError(`STT closed (${code}). If this persists, check DevTools → Network → WS for 401/403.`);
        if (status !== "idle") setStatus("idle");
        cleanup();
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording");
      setStatus("idle");
      cleanup();
    }
  }, [chunkMs, cleanup, consultationId, detectedLanguage, getDeepgramToken, status]);

  const pause = useCallback(async () => {
    mediaRecorderRef.current?.pause();
    setStatus("paused");
    await persistTranscript("paused");
  }, [persistTranscript]);

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume();
    setStatus("recording");
  }, []);

  const stop = useCallback(async () => {
    cleanup();
    setStatus("idle");
    await persistTranscript("completed");
  }, [cleanup, persistTranscript]);

  useEffect(() => {
    if (!consultationId || hydratedRef.current) return;
    let cancelled = false;

    const hydrate = async () => {
      try {
        const res = await fetch(`/api/transcripts/upsert?consultation_id=${encodeURIComponent(consultationId)}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;

        const savedSegments = Array.isArray(data?.transcript?.segments) ? data.transcript.segments : [];
        const mapped: STTSegment[] = savedSegments
          .map((segment: any): STTSegment | null => {
            const text = String(segment?.text ?? "").trim();
            const id = String(segment?.id ?? "").trim() || crypto.randomUUID();
            if (!text) return null;
            return {
              id,
              text,
              speaker: segment?.speaker === "patient" ? "patient" : "doctor",
              timestamp: String(segment?.timestamp ?? new Date().toISOString()),
              confidence: typeof segment?.confidence === "number" ? segment.confidence : 0,
              is_final: typeof segment?.is_final === "boolean" ? segment.is_final : true,
              start_ms: typeof segment?.start_ms === "number" ? segment.start_ms : undefined,
              end_ms: typeof segment?.end_ms === "number" ? segment.end_ms : undefined,
              language: typeof segment?.language === "string" ? segment.language : null,
            };
          })
          .filter(Boolean) as STTSegment[];

        if (mapped.length) {
          setSegments((prev) => (prev.length ? prev : mapped));
        }
      } catch {
        // Non-blocking: transcript hydration should not interrupt live recording.
      } finally {
        hydratedRef.current = true;
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    start,
    stop,
    pause,
    resume,
    status,
    segments,
    interimText,
    detectedLanguage,
    fullText,
    error,
  };
}
