"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, RatingBadge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#2563eb",
  info: "#6b7280",
};

const STATUS_LABEL: Record<string, string> = {
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  berjalan: "Berjalan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data: summary, error: summaryError, isLoading: summaryLoading } = useSWR("/api/dashboard/summary", fetcher, {
    refreshInterval: 4000,
  });

  const testsQuery = new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) }).toString();
  const { data: tests, error: testsError, isLoading: testsLoading, mutate } = useSWR(`/api/dashboard/tests?${testsQuery}`, fetcher, {
    refreshInterval: 5000,
  });

  const severityData = summary
    ? Object.entries(summary.severityCounts as Record<string, number>).map(([severity, count]) => ({ severity, count }))
    : [];
  const totalFindings = severityData.reduce((a, b) => a + b.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Gambaran seluruh tes keamanan, temuan, dan progres scan secara langsung.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sebaran Severity (temuan terbuka)</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <LoadingState rows={1} />
            ) : summaryError ? (
              <ErrorState description="Gagal memuat sebaran severity." />
            ) : totalFindings === 0 ? (
              <EmptyState title="Belum ada temuan" description="Sebaran severity akan muncul setelah ada temuan resmi." />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="severity" stroke="var(--muted)" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="var(--muted)" fontSize={12} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {severityData.map((d) => (
                        <Cell key={d.severity} fill={SEVERITY_COLOR[d.severity]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rating Keamanan Aplikasi</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <LoadingState rows={3} />
            ) : summaryError ? (
              <ErrorState description="Gagal memuat rating." />
            ) : summary.apps.length === 0 ? (
              <EmptyState title="Belum ada aplikasi" description="Aplikasi akan tampil setelah ditambahkan Admin." />
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.apps.map((app: { id: string; name: string; rating: string | null }) => (
                  <li key={app.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{app.name}</span>
                    <RatingBadge rating={app.rating} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress Scan Live</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <LoadingState rows={2} />
          ) : summaryError ? (
            <ErrorState description="Gagal memuat progres scan." />
          ) : summary.runningJobs.length === 0 ? (
            <EmptyState title="Tidak ada scan yang berjalan" description="Job yang sedang queued/running akan tampil di sini secara otomatis." />
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.runningJobs.map((job: { id: string; appName: string; status: string; currentStage: string | null; progressPct: number; jobType: string }) => (
                <li key={job.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{job.appName}</span>
                    <Badge variant={job.status === "running" ? "warning" : "muted"}>{job.status}</Badge>
                  </div>
                  <p className="font-data text-xs text-muted">{job.jobType} · tahap: {job.currentStage ?? "menunggu antrean"}</p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-surface-2">
                    <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${job.progressPct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CardTitle>Daftar Tes Keamanan</CardTitle>
          <div className="flex w-full gap-2 sm:w-auto">
            <Input placeholder="Cari aplikasi/tujuan/target..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            {(search || status) && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatus(""); }}>
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {testsLoading ? (
            <LoadingState rows={5} />
          ) : testsError ? (
            <ErrorState description="Gagal memuat daftar tes." onRetry={() => mutate()} />
          ) : tests.items.length === 0 ? (
            <EmptyState
              title={search || status ? "Tidak ada hasil yang cocok" : "Belum ada tes keamanan"}
              description={search || status ? "Coba ubah kata kunci atau filter." : "Ajukan permintaan uji pertama dari menu Permintaan Tes."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Tujuan</th>
                    <th className="py-2 pr-4">Penanggung Jawab</th>
                    <th className="py-2 pr-4">Diajukan</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.items.map((t: {
                    id: string; status: string; purpose: string; createdAt: string;
                    app: { id: string; name: string }; requester: { name: string };
                    latestJob: { status: string; progressPct: number } | null;
                  }) => (
                    <tr key={t.id} className="cursor-pointer border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link href={`/requests/${t.id}`} className="contents">
                          <Badge variant={t.status === "selesai" ? "success" : t.status === "ditolak" ? "danger" : "default"}>
                            {STATUS_LABEL[t.status] ?? t.status}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-foreground">{t.app.name}</td>
                      <td className="py-2 pr-4 text-muted">{t.purpose}</td>
                      <td className="py-2 pr-4 text-foreground">{t.requester.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(t.createdAt)}</td>
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
