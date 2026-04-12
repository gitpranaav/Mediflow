"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Menu } from "lucide-react";

import { Sidebar } from "@/src/components/doctor/Sidebar";

interface DoctorShellProps {
  children: ReactNode;
  doctorName: string;
  doctorSpecialization: string;
}

export function DoctorShell({ children, doctorName, doctorSpecialization }: DoctorShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.08),transparent_50%),hsl(var(--bg-primary))]">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        doctorName={doctorName}
        doctorSpecialization={doctorSpecialization}
      />
      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-[hsl(var(--text-secondary))] shadow-[var(--shadow-sm)] hover:bg-[hsl(var(--bg-secondary))] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <main className="min-h-0 flex-1 overflow-auto p-4 pt-16 md:p-6 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
