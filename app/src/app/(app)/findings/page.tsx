"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  dikerjakan: "Dikerjakan",
  menunggu_retest: "Menunggu Uji Ulang",
  selesai: "Selesai",
};

type FindingListItem = {
  id: string;
  title: string;
  severity: string;
  status: string;
  cvssScore: number | null;
  dueDate: string | null;
  source: "scan" | "manual";
  app: { id: string; name: string };
  createdAt: string;
};

export default function FindingsPage() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [appId, setAppId] = useState("");

  const { data: appsData } = useSWR("/api/findings/apps", fetcher);
  const apps: { id: string; name: string }[] = appsData?.items ?? [];

  const query = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(severity ? { severity } : {}),
    ...(status ? { status } : {}),
    ...(appId ? { appId } : {}),
  }).toString();

  const { data, error, isLoading, mutate } = useSWR(`/api/findings?${query}`, fetcher, { refreshInterval: 10000 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daftar Temuan</h1>
          <p className="text-sm text-muted">Semua temuan resmi, baik hasil verifikasi kandidat scan maupun temuan manual.</p>
        </div>
        <Link href="/findings/new">
          <Button>+ Temuan Manual</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-3 lg:flex-row lg:items-center">
          <CardTitle>Temuan</CardTitle>
          <div className="flex w-full flex-wrap gap-2 lg:w-auto">
            <Input placeholder="Cari judul/aplikasi..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-48" />
            <Select value={appId} onChange={(e) => setAppId(e.target.value)} className="w-40">
              <option value="">Semua aplikasi</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-32">
              <option value="">Semua severity</option>
              {["critical", "high", "medium", "low", "info"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            {(search || severity || status || appId) && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSeverity(""); setStatus(""); setAppId(""); }}>
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={6} />
          ) : error ? (
            <ErrorState description="Gagal memuat daftar temuan." onRetry={() => mutate()} />
          ) : data.items.length === 0 ? (
            <EmptyState
              title={search || severity || status || appId ? "Tidak ada hasil yang cocok" : "Belum ada temuan"}
              description={search || severity || status || appId ? "Coba ubah kata kunci atau filter." : "Temuan akan muncul setelah verifikasi kandidat atau input manual."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Judul</th>
                    <th className="py-2 pr-4">Sumber</th>
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Severity</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Tenggat</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((f: FindingListItem) => {
                    const overdue = f.dueDate && f.status !== "selesai" && new Date(f.dueDate) < new Date();
                    return (
                      <tr key={f.id} className="border-b border-border/60 hover:bg-surface-2">
                        <td className="py-2 pr-4">
                          <Link href={`/findings/${f.id}`} className="text-foreground hover:underline">{f.title}</Link>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant={f.source === "scan" ? "default" : "outline"}>{f.source === "scan" ? "Dari Scan" : "Manual"}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-foreground">{f.app.name}</td>
                        <td className="py-2 pr-4"><SeverityBadge severity={f.severity} /></td>
                        <td className="py-2 pr-4 text-muted">{STATUS_LABEL[f.status] ?? f.status}</td>
                        <td className={`py-2 pr-4 font-data text-xs ${overdue ? "text-danger" : "text-muted"}`}>
                          {f.dueDate ? formatDate(f.dueDate) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
