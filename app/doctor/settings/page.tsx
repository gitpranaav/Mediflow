"use client";

import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";

export default function DoctorSettingsPage() {
  const [receptionistPassword, setReceptionistPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    const response = await fetch("/api/doctor/receptionist-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receptionist_password: receptionistPassword }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "Failed to update password");
    setReceptionistPassword("");
    setMessage("Receptionist password updated.");
  };

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage clinic access and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Input
              label="Receptionist password"
              type="password"
              value={receptionistPassword}
              onChange={(e) => setReceptionistPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
            <p className="text-xs text-[hsl(var(--text-muted))]">
              Receptionist logs in using your email + this password at <code>/receptionist/login</code>.
            </p>
          </div>
          {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}
          {message ? <p className="text-xs text-[hsl(var(--success))]">{message}</p> : null}
          <Button loading={loading} onClick={save} disabled={receptionistPassword.trim().length < 6}>
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

