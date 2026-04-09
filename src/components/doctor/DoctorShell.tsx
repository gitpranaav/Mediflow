"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Header } from "@/src/components/doctor/Header";
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
        doctorName={doctorName}
        doctorSpecialization={doctorSpecialization}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((prev) => !prev)}
          onOpenMobileMenu={() => setMobileOpen(true)}
          doctorName={doctorName}
        />
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
