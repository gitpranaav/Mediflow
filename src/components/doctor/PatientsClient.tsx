"use client";

import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AddPatientModal } from "@/src/components/doctor/AddPatientModal";
import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";

interface PatientRow {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  phone: string | null;
  abha_id: string | null;
  chronic_conditions: string[] | null;
  last_consultation_at: string | null;
}

function ageFromDob(dob: string | null) {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return `${Math.max(age, 0)}`;
}

function dateLabel(value: string | null) {
  if (!value) return "No consultations";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No consultations";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function PatientsClient({ patients }: { patients: PatientRow[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((patient) => {
      return (
        patient.name.toLowerCase().includes(q) ||
        (patient.phone ?? "").toLowerCase().includes(q) ||
        (patient.abha_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [patients, query]);

  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const normalizedPage = Math.min(page, totalPages);
  const paged = filtered.slice((normalizedPage - 1) * perPage, normalizedPage * perPage);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Patients</CardTitle>
              <CardDescription>Search and manage patient records.</CardDescription>
            </div>
            <AddPatientModal />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-md"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone, ABHA ID"
              iconLeft={<Search className="h-4 w-4" />}
            />
            <div className="ml-auto inline-flex rounded-[calc(var(--radius)-2px)] border border-[hsl(var(--border))] p-0.5">
              <button
                className={`inline-flex h-9 items-center gap-1 rounded-[calc(var(--radius)-4px)] px-3 text-sm ${
                  view === "table" ? "bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]"
                }`}
                onClick={() => setView("table")}
              >
                <List className="h-4 w-4" />
                Table
              </button>
              <button
                className={`inline-flex h-9 items-center gap-1 rounded-[calc(var(--radius)-4px)] px-3 text-sm ${
                  view === "grid" ? "bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]"
                }`}
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
            </div>
          </div>

          {view === "table" ? (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-[hsl(var(--border))]">
              <table className="min-w-full text-sm">
                <thead className="bg-[hsl(var(--bg-secondary))] text-left text-[hsl(var(--text-secondary))]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Age</th>
                    <th className="px-3 py-2 font-medium">Gender</th>
                    <th className="px-3 py-2 font-medium">Blood</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Last Consultation</th>
                    <th className="px-3 py-2 font-medium">Conditions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((patient) => (
                    <tr key={patient.id} className="border-t border-[hsl(var(--border))]">
                      <td className="px-3 py-2">
                        <Link href={`/doctor/patients/${patient.id}`} className="inline-flex items-center gap-2 hover:underline">
                          <Avatar size="sm" name={patient.name} />
                          <span className="font-medium text-[hsl(var(--text-primary))]">{patient.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{ageFromDob(patient.dob)}</td>
                      <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{patient.gender ?? "—"}</td>
                      <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{patient.blood_group ?? "—"}</td>
                      <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{patient.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-[hsl(var(--text-secondary))]">{dateLabel(patient.last_consultation_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(patient.chronic_conditions ?? []).slice(0, 2).map((condition) => (
                            <Badge key={condition} variant="warning">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {paged.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/doctor/patients/${patient.id}`}
                  className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] p-3 transition-colors hover:bg-[hsl(var(--bg-secondary))]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={patient.name} />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--text-primary))]">{patient.name}</p>
                      <p className="text-xs text-[hsl(var(--text-muted))]">
                        {ageFromDob(patient.dob)} yrs · {patient.gender ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[hsl(var(--text-secondary))]">
                    <p>Blood group: {patient.blood_group ?? "—"}</p>
                    <p>Phone: {patient.phone ?? "—"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!filtered.length ? <p className="text-sm text-[hsl(var(--text-muted))]">No patients found.</p> : null}

          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-3">
            <p className="text-xs text-[hsl(var(--text-muted))]">
              Page {normalizedPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={normalizedPage <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={normalizedPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
