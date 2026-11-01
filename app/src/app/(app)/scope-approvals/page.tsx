"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type QueueItem = {
  id: string;
  versionNo: number;
  createdAt: string;
  hasDiff: boolean;
  creator: { id: string; name: string };
  request: { id: string; purpose: string; targetUrl: string; app: { id: string; name: string } };
};

export default function ScopeApprovalsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ items: QueueItem[]; error?: string }>(
    "/api/scope-approvals",
    fetcher,
    { refreshInterval: 8000 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Persetujuan Ruang Lingkup</h1>
        <p className="text-sm text-muted">Antrean versi ruang lingkup final yang menunggu keputusan Anda sebagai Coordinator.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Menunggu Keputusan</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={4} />
          ) : error || data?.error ? (
            <ErrorState description={data?.error ?? "Gagal memuat antrean persetujuan."} onRetry={() => mutate()} />
          ) : data!.items.length === 0 ? (
            <EmptyState
              title="Tidak ada antrean"
              description="Belum ada ruang lingkup final yang menunggu persetujuan pada aplikasi yang Anda koordinatori."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Tujuan</th>
                    <th className="py-2 pr-4">Versi</th>
                    <th className="py-2 pr-4">Disusun Oleh</th>
                    <th className="py-2 pr-4">Ditandai Final</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((q) => (
                    <tr key={q.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link href={`/requests/${q.request.id}`} className="text-foreground hover:underline">{q.request.app.name}</Link>
                      </td>
                      <td className="py-2 pr-4 text-muted">{q.request.purpose}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="warning">v{q.versionNo}{q.hasDiff ? "" : " (pertama)"}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-foreground">{q.creator.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(q.createdAt)}</td>
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
