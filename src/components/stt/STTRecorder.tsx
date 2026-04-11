"use client";

import { Mic, Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import type { STTStatus } from "@/src/hooks/useSTT";

interface Props {
  status: STTStatus;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  disabled?: boolean;
}

export function STTRecorder({ status, error, onStart, onStop, onPause, onResume, disabled = false }: Props) {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "recording") {
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="info">Status: {status}</Badge>
        <p className="text-sm text-[hsl(var(--text-secondary))]">{hh}:{mm}:{ss}</p>
      </div>

      <div className="flex items-center gap-2">
        {status === "idle" ? (
          <Button onClick={onStart} iconLeft={<Mic className="h-4 w-4" />} disabled={disabled}>Start</Button>
        ) : (
          <>
            {status === "recording" ? (
              <Button variant="secondary" onClick={onPause} iconLeft={<Pause className="h-4 w-4" />} disabled={disabled}>Pause</Button>
            ) : (
              <Button variant="secondary" onClick={onResume} iconLeft={<Play className="h-4 w-4" />} disabled={disabled}>Resume</Button>
            )}
            <Button variant="danger" onClick={onStop} iconLeft={<Square className="h-4 w-4" />} disabled={disabled}>Stop</Button>
          </>
        )}
      </div>

      {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}
    </div>
  );
}
