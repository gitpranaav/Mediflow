"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  triggerIcon?: ReactNode;
}

export function Select({
  value,
  onValueChange,
  placeholder = "Select an option",
  options,
  disabled,
  className,
  contentClassName,
  triggerIcon,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          "inline-flex h-10 w-full items-center justify-between rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] px-3 text-sm text-[hsl(var(--text-primary))] shadow-[var(--shadow-sm)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg-primary))]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="text-[hsl(var(--text-muted))]">{triggerIcon ?? <ChevronDown className="h-4 w-4" />}</SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-1 shadow-[var(--shadow-md)]",
            contentClassName
          )}
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-[calc(var(--radius)-4px)] py-2 pl-8 pr-2 text-sm text-[hsl(var(--text-primary))] outline-none transition-colors",
                  "focus:bg-[hsl(var(--bg-secondary))] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center text-[hsl(var(--accent))]">
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
