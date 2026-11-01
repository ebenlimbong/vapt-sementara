"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const JOB_STATUS_LABEL: Record<string, string> = {
  queued: "Menunggu",
  running: "Berjalan",
  done: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

const JOB_STATUS_VARIANT: Record<string, "default" | "outline" | "success" | "warning" | "danger" | "muted"> = {
  queued: "muted",
  running: "warning",
  done: "success",
  failed: "danger",
  cancelled: "outline",
};

const JOB_TYPE_LABEL: Record<string, string> = {
  web_scan: "Scan Web",
  retest: "Retest",
};

type EligibleRequest = {
  id: string;
  purpose: string;
  targetUrl: string;
  status: string;
  app: { id: string; name: string };
  requester: { id: string; name: string };
  permission: { allowed: true; windowStart: string; windowEnd: string } | { allowed: false; reason: string };
};

type JobItem = {
  id: string;
  jobType: string;
  status: string;
  currentStage: string | null;
  progressPct: number;
  queuedAt: string;
  queuePosition: number | null;
  targetUrl: string;
  app: { id: string; name: string };
  requester: { id: string; name: string };
  creator: { id: string; name: string };
};

export default function ScanWebPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [appId, setAppId] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const {
    data: eligible,
    error: eligibleError,
    isLoading: eligibleLoading,
    mutate: mutateEligible,
  } = useSWR<{ items: EligibleRequest[] }>("/api/scan-web/requests", fetcher, { refreshInterval: 15000 });

  const query = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(appId ? { appId } : {}),
  }).toString();

  const {
    data: jobs,
    error: jobsError,
    isLoading: jobsLoading,
    mutate: mutateJobs,
  } = useSWR<{ items: JobItem[]; total: number; apps: { id: string; name: string }[] }>(
    `/api/scan-web/jobs?${query}`,
    fetcher,
    { refreshInterval: 3000 }
  );

  async function handleRun(requestId: string) {
    setRunError(null);
    setRunningId(requestId);
    try {
      const res = await fetch("/api/scan-web/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunError(data.error ?? "Gagal menjalankan scan.");
        return;
      }
      await Promise.all([mutateJobs(), mutateEligible()]);
    } catch {
      setRunError("Gagal menghubungi server.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Scan Otomatis Web</h1>
        <p className="text-sm text-muted">
          Antrean pekerjaan scan web, progres per tahap, dan kandidat temuan. Scan hanya bisa dijalankan bila
          ruang lingkup sudah disetujui dan masih dalam jendela waktu tes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jalankan Scan Baru</CardTitle>
        </CardHeader>
        <CardContent>
          {eligibleLoading ? (
            <LoadingState rows={2} />
          ) : eligibleError ? (
            <ErrorState description="Gagal memuat daftar permintaan." onRetry={() => mutateEligible()} />
          ) : eligible!.items.length === 0 ? (
            <EmptyState
              title="Tidak ada permintaan yang bisa di-scan"
              description="Anda harus berperan sebagai pentester, dan permintaan tesnya sudah disetujui serta masih dalam jendela waktu tes, untuk bisa menjalankan scan di sini."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {runError && <p className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">{runError}</p>}
              {eligible!.items.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.app.name}</p>
                    <p className="truncate text-xs text-muted">{r.purpose}</p>
                    <p className="font-data truncate text-xs text-muted">{r.targetUrl}</p>
                    {!r.permission.allowed && (
                      <p className="mt-1 text-xs text-danger">{r.permission.reason}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={!r.permission.allowed || runningId === r.id}
                    title={!r.permission.allowed ? r.permission.reason : "Masukkan ke antrean scan"}
                    onClick={() => handleRun(r.id)}
                  >
                    {runningId === r.id ? "Mengirim..." : "Jalankan Scan"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CardTitle>Antrean & Riwayat Scan</CardTitle>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Input
              placeholder="Cari aplikasi/target/tujuan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56"
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">Semua status</option>
              {Object.entries(JOB_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select value={appId} onChange={(e) => setAppId(e.target.value)} className="w-44">
              <option value="">Semua aplikasi</option>
              {(jobs?.apps ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {(search || status || appId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setAppId("");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <LoadingState rows={5} />
          ) : jobsError ? (
            <ErrorState description="Gagal memuat antrean scan." onRetry={() => mutateJobs()} />
          ) : jobs!.items.length === 0 ? (
            <EmptyState
              title={search || status || appId ? "Tidak ada hasil yang cocok" : "Belum ada scan yang dijalankan"}
              description={
                search || status || appId
                  ? "Coba ubah kata kunci atau filter."
                  : "Scan yang dijalankan pentester akan muncul di sini beserta posisi antrean dan progresnya."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Jenis</th>
                    <th className="py-2 pr-4">Dijalankan Oleh</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Antrean</th>
                    <th className="py-2 pr-4">Progres</th>
                    <th className="py-2 pr-4">Diminta</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs!.items.map((j) => (
                    <tr key={j.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link href={`/scan-web/${j.id}`} className="text-foreground hover:underline">
                          {j.app.name}
                        </Link>
                        <p className="font-data truncate text-xs text-muted">{j.targetUrl}</p>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{JOB_TYPE_LABEL[j.jobType] ?? j.jobType}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-foreground">{j.creator.name}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={JOB_STATUS_VARIANT[j.status] ?? "default"}>
                          {JOB_STATUS_LABEL[j.status] ?? j.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">
                        {j.status === "queued" ? `#${j.queuePosition}` : "-"}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-surface-2">
                            <div
                              className="h-1.5 rounded-full bg-accent transition-all"
                              style={{ width: `${j.progressPct}%` }}
                            />
                          </div>
                          <span className="font-data text-xs text-muted">{j.progressPct}%</span>
                        </div>
                        {j.currentStage && <p className="font-data text-xs text-muted">{j.currentStage}</p>}
                      </td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(j.queuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
