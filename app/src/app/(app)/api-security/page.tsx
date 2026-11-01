"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SpecSummary = { id: string; fileName: string; createdAt: string; endpointCount: number };
type AppItem = {
  id: string;
  name: string;
  baseUrl: string;
  environment: string;
  roles: string[];
  specs: SpecSummary[];
};

export default function ApiSecurityPage() {
  const { data, error, isLoading, mutate } = useSWR<{ items: AppItem[] }>(
    "/api/api-security/apps",
    fetcher
  );
  const [uploadForAppId, setUploadForAppId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Uji Akses API</h1>
        <p className="text-sm text-muted">
          Impor definisi OpenAPI 3.x, inventaris endpoint, akun uji per role, dan skenario
          ekspektasi akses (BOLA/auth) untuk aplikasi kategori API.
        </p>
      </div>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState description="Gagal memuat daftar aplikasi API." onRetry={() => mutate()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Belum ada aplikasi API yang bisa diakses"
          description="Anda belum punya penugasan (admin/coordinator/tester) pada aplikasi kategori API, atau belum ada aplikasi API yang didaftarkan."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.items.map((app) => {
            const canImport = app.roles.includes("tester");
            return (
              <Card key={app.id}>
                <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle>{app.name}</CardTitle>
                    <p className="font-data text-xs text-muted">{app.baseUrl}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{app.environment}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canImport}
                      title={canImport ? undefined : "Hanya Tester yang bisa mengimpor OpenAPI."}
                      onClick={() => setUploadForAppId(app.id)}
                    >
                      Impor OpenAPI
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {app.specs.length === 0 ? (
                    <EmptyState
                      title="Belum ada spesifikasi diimpor"
                      description="Impor berkas OpenAPI (JSON/YAML) untuk mulai memetakan endpoint."
                    />
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {app.specs.map((spec) => (
                        <li key={spec.id}>
                          <Link
                            href={`/api-security/${spec.id}`}
                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
                          >
                            <span className="font-data text-foreground">{spec.fileName}</span>
                            <span className="flex items-center gap-3 text-xs text-muted">
                              <span>{spec.endpointCount} endpoint</span>
                              <span className="font-data">{formatDateTime(spec.createdAt)}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {uploadForAppId && (
        <UploadSpecDialog
          appId={uploadForAppId}
          appName={data?.items.find((a) => a.id === uploadForAppId)?.name ?? ""}
          onClose={() => setUploadForAppId(null)}
          onImported={() => {
            setUploadForAppId(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function UploadSpecDialog({
  appId,
  appName,
  onClose,
  onImported,
}: {
  appId: string;
  appName: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Pilih berkas OpenAPI (.json/.yaml/.yml) terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("appId", appId);
      form.append("file", file);
      const res = await fetch("/api/api-security/specs", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Gagal mengimpor berkas OpenAPI.");
        return;
      }
      onImported();
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Impor OpenAPI — {appName}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="openapi-file">Berkas OpenAPI 3.x (JSON atau YAML)</Label>
              <Input
                id="openapi-file"
                type="file"
                accept=".json,.yaml,.yml,application/json,application/x-yaml,text/yaml"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <FieldError>{error}</FieldError>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Mengimpor..." : "Impor"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
