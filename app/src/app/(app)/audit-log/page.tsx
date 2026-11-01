"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ENTITY_TYPES = [
  "test_request",
  "scope_version",
  "application",
  "user",
  "app_assignment",
  "credential_vault",
  "platform",
];

type LogRow = {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export default function AuditLogPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const query = new URLSearchParams({
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page: String(page),
    pageSize: String(pageSize),
  }).toString();

  const { data, error, isLoading, mutate } = useSWR<{ items: LogRow[]; total: number; error?: string }>(
    `/api/audit-log?${query}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Jejak Audit</h1>
        <p className="text-sm text-muted">Catatan append-only seluruh aksi penting. Tidak ada aksi ubah/hapus pada halaman ini.</p>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-3">
          <CardTitle>Filter</CardTitle>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-4">
            <Input placeholder="Cari action (mis. scope_approval)" value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} />
            <Select value={entityType} onChange={(e) => { setPage(1); setEntityType(e.target.value); }}>
              <option value="">Semua entitas</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input type="datetime-local" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
            <Input type="datetime-local" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={6} />
          ) : error || data?.error ? (
            <ErrorState description={data?.error ?? "Gagal memuat jejak audit."} onRetry={() => mutate()} />
          ) : data!.items.length === 0 ? (
            <EmptyState title="Tidak ada catatan" description="Belum ada aksi yang cocok dengan filter saat ini." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted">
                      <th className="py-2 pr-4">Waktu</th>
                      <th className="py-2 pr-4">Pelaku</th>
                      <th className="py-2 pr-4">Aksi</th>
                      <th className="py-2 pr-4">Objek</th>
                      <th className="py-2 pr-4">Metadata</th>
                      <th className="py-2 pr-4">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.items.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-4 font-data text-xs text-muted whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                        <td className="py-2 pr-4 text-foreground whitespace-nowrap">{r.actor?.name ?? "Sistem"}</td>
                        <td className="py-2 pr-4 font-data text-xs text-foreground whitespace-nowrap">{r.action}</td>
                        <td className="py-2 pr-4 font-data text-xs text-muted whitespace-nowrap">{r.entityType ?? "-"}{r.entityId ? ` #${r.entityId.slice(0, 8)}` : ""}</td>
                        <td className="py-2 pr-4">
                          <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap font-data text-[11px] text-muted">
                            {r.metadata ? JSON.stringify(r.metadata, null, 0) : "-"}
                          </pre>
                        </td>
                        <td className="py-2 pr-4 font-data text-xs text-muted whitespace-nowrap">{r.ipAddress ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted">
                <span>Halaman {page} dari {totalPages} &middot; {data!.total} total catatan</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
