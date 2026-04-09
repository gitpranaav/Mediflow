"use client";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";

interface Suggestion {
  code: string;
  description: string;
  confidence?: "high" | "medium" | "low";
}

export function AISuggestions({
  suggestions,
  onAccept,
  onReject,
  onAcceptAll,
}: {
  suggestions: Suggestion[];
  onAccept: (s: Suggestion) => void;
  onReject: (s: Suggestion) => void;
  onAcceptAll: () => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">AI Suggestions</p>
        <Button size="sm" variant="secondary" onClick={onAcceptAll}>Accept All</Button>
      </div>
      <div className="space-y-1">
        {suggestions.map((s) => (
          <div key={`${s.code}-${s.description}`} className="flex items-center justify-between rounded-[var(--radius)] border border-[hsl(var(--border))] p-2">
            <div>
              <Badge variant="warning">AI</Badge> <span className="font-mono text-xs">{s.code}</span> - <span className="text-sm">{s.description}</span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => onAccept(s)}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => onReject(s)}>Reject</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
