import type { ReactNode } from "react";

import { ErrorBoundary } from "@/src/components/ErrorBoundary";

export default function ReceptionistLayout({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

