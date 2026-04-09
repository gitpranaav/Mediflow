"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Input } from "@/src/components/ui/Input";

export interface ICDItem {
  id: string;
  code: string;
  description: string;
  category?: string | null;
  is_billable?: boolean | null;
  is_common?: boolean;
}

export function ICD10Search({
  selected,
  onSelect,
  onRemove,
}: {
  selected: Array<ICDItem & { is_primary?: boolean; ai?: boolean; confidence?: string }>;
  onSelect: (code: ICDItem) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ICDItem[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) return setResults([]);
      const res = await fetch(`/api/icd/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      setResults(data.codes ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ICD-10 code or diagnosis..." />
      <div className="max-h-40 space-y-1 overflow-auto rounded-[var(--radius)] border border-[hsl(var(--border))] p-2">
        {results.map((item) => (
          <button
            key={item.id}
            type="button"
            className="block w-full rounded-[calc(var(--radius)-4px)] px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--bg-secondary))]"
            onClick={() => onSelect(item)}
          >
            <span className="font-mono">[{item.code}]</span> - {item.description}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {selected.map((item) => (
          <div key={item.id} className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-1">
            <Badge variant="outline" className="font-mono">{item.code}</Badge>
            <span className="text-xs">{item.description}</span>
            <button onClick={() => onRemove(item.id)} className="text-xs text-[hsl(var(--danger))]">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}
