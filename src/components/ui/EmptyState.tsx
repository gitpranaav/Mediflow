import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[hsl(var(--border))] p-8 text-center">
      <svg viewBox="0 0 120 80" className="mx-auto mb-3 h-20 w-32 text-[hsl(var(--text-muted))]">
        <rect x="10" y="16" width="100" height="50" rx="8" fill="currentColor" opacity="0.12" />
        <circle cx="36" cy="40" r="8" fill="currentColor" opacity="0.25" />
        <rect x="50" y="34" width="46" height="4" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="50" y="44" width="32" height="4" rx="2" fill="currentColor" opacity="0.25" />
      </svg>
      <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{title}</p>
      <p className="mt-1 text-xs text-[hsl(var(--text-muted))]">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
