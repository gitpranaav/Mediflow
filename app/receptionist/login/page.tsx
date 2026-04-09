"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Input } from "@/src/components/ui/Input";

export default function ReceptionistLoginPage() {
  const router = useRouter();
  const [doctorEmail, setDoctorEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    const response = await fetch("/api/auth/receptionist/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctor_email: doctorEmail, password }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error ?? "Login failed");
    router.push("/receptionist/patients");
    router.refresh();
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Receptionist Login</CardTitle>
          <CardDescription>Sign in using the doctor&apos;s email and receptionist password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input label="Doctor email" value={doctorEmail} onChange={(e) => setDoctorEmail(e.target.value)} />
          <Input label="Receptionist password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-xs text-[hsl(var(--danger))]">{error}</p> : null}
          <Button loading={loading} onClick={signIn}>
            Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

