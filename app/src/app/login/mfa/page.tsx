"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  );
}

function MfaForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kode verifikasi salah.");
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold text-foreground">Verifikasi Dua Langkah</h1>
        <p className="mb-6 text-sm text-muted">Masukkan kode 6 digit dari aplikasi autentikator Anda.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Kode Verifikasi</Label>
            <Input id="code" inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="font-data text-center tracking-widest" />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
            {loading ? "Memverifikasi..." : "Verifikasi"}
          </Button>
        </form>
      </div>
    </div>
  );
}
