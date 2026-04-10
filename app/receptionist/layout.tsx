import type { ReactNode } from "react";

import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { ThemeToggle } from "@/src/components/theme/ThemeToggle";

export default function ReceptionistLayout({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <div className="relative">
        <div className="fixed right-4 top-4 z-40">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </ErrorBoundary>
  );
}

