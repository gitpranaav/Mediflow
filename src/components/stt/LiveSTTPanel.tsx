"use client";

import { useSTT } from "@/src/hooks/useSTT";
import { STTRecorder } from "@/src/components/stt/STTRecorder";
import { TranscriptViewer } from "@/src/components/stt/TranscriptViewer";

export function LiveSTTPanel({ consultationId }: { consultationId: string }) {
  const stt = useSTT({ consultationId });

  return (
    <div className="space-y-4">
      <STTRecorder status={stt.status} error={stt.error} onStart={stt.start} onStop={stt.stop} onPause={stt.pause} onResume={stt.resume} />
      <TranscriptViewer segments={stt.segments as any} interimText={stt.interimText} />
    </div>
  );
}
