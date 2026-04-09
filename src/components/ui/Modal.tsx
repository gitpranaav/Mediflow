"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils";

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  contentClassName,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-5 shadow-[var(--shadow-md)]",
            "focus-visible:outline-none",
            contentClassName
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              {title ? <Dialog.Title className="text-lg font-semibold text-[hsl(var(--text-primary))]">{title}</Dialog.Title> : null}
              {description ? (
                <Dialog.Description className="text-sm text-[hsl(var(--text-muted))]">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[hsl(var(--text-muted))] transition-colors hover:bg-[hsl(var(--bg-secondary))] hover:text-[hsl(var(--text-primary))]"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div>{children}</div>
          {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
