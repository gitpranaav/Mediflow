import type { HTMLAttributes } from "react";

import { cn } from "@/src/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]",
  success: "bg-[hsl(var(--success)/0.16)] text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning)/0.16)] text-[hsl(var(--warning))]",
  danger: "bg-[hsl(var(--danger)/0.16)] text-[hsl(var(--danger))]",
  info: "bg-[hsl(var(--bg-secondary))] text-[hsl(var(--text-secondary))]",
  outline: "border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--text-primary))]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
