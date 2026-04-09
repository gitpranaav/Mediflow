"use client";

import type { ReactNode } from "react";
import React from "react";

import { Button } from "@/src/components/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--danger))] bg-[hsl(var(--danger)/0.08)] p-4">
          <p className="text-sm text-[hsl(var(--text-primary))]">Something went wrong.</p>
          <Button size="sm" className="mt-2" onClick={() => this.setState({ hasError: false })}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
