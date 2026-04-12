"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/src/components/ui/Button";

interface Segment {
  id: string;
  text: string;
  timestamp: string;
}

export function TranscriptViewer({ segments, interimText }: { segments: Segment[]; interimText?: string }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fullText = segments.map((s) => s.text).join(" ");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [segments]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[hsl(var(--text-muted))]">Word count: {fullText.split(/\s+/).filter(Boolean).length}</p>
      <div className="max-h-80 space-y-2 overflow-auto rounded-[var(--radius)] border border-[hsl(var(--border))] p-2">
        {segments.map((segment) => (
          <div key={segment.id} className="rounded-[calc(var(--radius)-4px)] bg-[hsl(var(--bg-secondary))] px-2 py-1.5">
            <p className="text-sm leading-relaxed text-[hsl(var(--text-primary))]">{segment.text}</p>
          </div>
        ))}
        {interimText?.trim() ? (
          <div className="rounded-[calc(var(--radius)-4px)] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--bg-secondary))] px-2 py-1.5">
            <p className="text-sm leading-relaxed text-[hsl(var(--text-primary))] opacity-80">{interimText}</p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
