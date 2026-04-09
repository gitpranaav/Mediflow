import { cn } from "@/src/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[calc(var(--radius)-2px)] bg-[hsl(var(--bg-secondary))]", className)} />;
}
