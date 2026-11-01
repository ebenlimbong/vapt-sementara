"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "info"] as const;

export default function NewFindingPage() {
  const router = useRouter();
  const { data: appsData, error: appsError, isLoading: appsLoading } = useSWR("/api/findings/apps", fetcher);
  const apps: { id: string; name: string; roles: string[] }[] = appsData?.items ?? [];
  const testerApps = apps.filter((a) => a.roles.includes("tester"));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const payload = {
      appId: String(fd.get("appId") ?? ""),
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      steps: String(fd.get("steps") ?? ""),
      impact: String(fd.get("impact") ?? ""),
      severity: String(fd.get("severity") ?? ""),
    };
    setSubmitting(true);
    const res = await fetch("/api/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setFormError(json.error ?? "Gagal menyimpan temuan manual.");
      setFieldErrors(json.issues ?? {});
      return;
    }
    router.push(`/findings/${json.finding.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Temuan Manual</h1>
        <p className="text-sm text-muted">Catat temuan hasil pengujian tangan, lengkap dengan langkah reproduksi dan dampaknya.</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Formulir Temuan Manual</CardTitle>
        </CardHeader>
        <CardContent>
          {appsLoading ? (
            <LoadingState rows={3} />
          ) : appsError ? (
            <ErrorState description="Gagal memuat daftar aplikasi." />
          ) : testerApps.length === 0 ? (
            <EmptyState title="Anda belum punya peran Tester di aplikasi manapun" description="Hubungi Coordinator/Admin untuk mendapat penugasan peran Tester." />
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="appId">Aplikasi</Label>
                <Select name="appId" id="appId" required defaultValue="">
                  <option value="" disabled>Pilih aplikasi...</option>
                  {testerApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
                <FieldError>{fieldErrors.appId?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="title">Judul</Label>
                <Input name="title" id="title" required />
                <FieldError>{fieldErrors.title?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="severity">Severity Awal</Label>
                <Select name="severity" id="severity" required defaultValue="medium">
                  {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea name="description" id="description" rows={4} required />
                <FieldError>{fieldErrors.description?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="steps">Langkah Reproduksi</Label>
                <Textarea name="steps" id="steps" rows={4} required />
                <FieldError>{fieldErrors.steps?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="impact">Dampak</Label>
                <Textarea name="impact" id="impact" rows={3} required />
                <FieldError>{fieldErrors.impact?.[0]}</FieldError>
              </div>

              {formError && <p className="text-xs text-danger">{formError}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.push("/findings")}>Batal</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Temuan"}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
