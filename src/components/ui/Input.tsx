import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/src/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  iconLeft?: ReactNode;
}

export function Input({ className, label, error, iconLeft, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-[hsl(var(--text-secondary))]">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {iconLeft ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]">
            {iconLeft}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "h-10 w-full rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] px-3 text-sm text-[hsl(var(--text-primary))] shadow-[var(--shadow-sm)] transition-all",
            "placeholder:text-[hsl(var(--text-muted))]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg-primary))]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            iconLeft ? "pl-9" : "",
            error ? "border-[hsl(var(--danger))] focus-visible:ring-[hsl(var(--danger))]" : "",
            className
          )}
          {...props}
        />
      </div>
      {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}
    </div>
  );
}
