"use client";

import { Printer } from "lucide-react";

import { Button } from "@/src/components/ui/Button";

export function PrescriptionPrintButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="print:hidden"
      iconLeft={<Printer className="h-3.5 w-3.5" />}
      onClick={() => window.print()}
    >
      Print Prescription
    </Button>
  );
}
