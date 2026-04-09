import { cn } from "@/src/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-7 w-7 border-[3px]",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block animate-spin rounded-full border-[hsl(var(--text-muted))] border-t-[hsl(var(--accent))]",
        sizeClasses[size],
        className
      )}
    />
  );
}
