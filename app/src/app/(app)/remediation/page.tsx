"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { formatDate, cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COLUMNS: { key: string; label: string }[] = [
  { key: "baru", label: "Baru" },
  { key: "dikerjakan", label: "Dikerjakan" },
  { key: "menunggu_retest", label: "Menunggu Uji Ulang" },
  { key: "selesai", label: "Selesai" },
];

type FindingCard = {
  id: string;
  title: string;
  severity: string;
  status: string;
  dueDate: string | null;
  app: { id: string; name: string; owner?: { id: string; name: string } | null };
};

function dueTone(f: { dueDate: string | null; status: string }): "overdue" | "near" | "ok" | "none" {
  if (!f.dueDate || f.status === "selesai") return "none";
  const diffDays = Math.ceil((new Date(f.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "near";
  return "ok";
}

function FindingKanbanCard({ f }: { f: FindingCard }) {
  const tone = dueTone(f);
  return (
    <Link href={`/findings/${f.id}`}>
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm hover:bg-surface-2">
        <p className="font-medium text-foreground">{f.title}</p>
        <p className="text-xs text-muted">{f.app.name}</p>
        <div className="flex items-center justify-between">
          <SeverityBadge severity={f.severity} />
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-data",
              tone === "overdue" && "border-danger/40 bg-danger/15 text-danger",
              tone === "near" && "border-warning/40 bg-warning/15 text-warning",
              (tone === "ok" || tone === "none") && "border-border text-muted"
            )}
          >
            {f.dueDate ? formatDate(f.dueDate) : "-"}
          </span>
        </div>
        <p className="text-xs text-muted">PIC: {f.app.owner?.name ?? "-"}</p>
      </div>
    </Link>
  );
}

export default function RemediationPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/findings?pageSize=200", fetcher, { refreshInterval: 10000 });
  const { data: dueSoonData } = useSWR("/api/findings/due-soon", fetcher, { refreshInterval: 15000 });

  const items: FindingCard[] = data?.items ?? [];
  const urgent: FindingCard[] = dueSoonData?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Papan Perbaikan</h1>
        <p className="text-sm text-muted">Pantau perbaikan temuan dari Baru sampai Selesai. Buka temuan untuk menanggapi, mengubah status, atau menjalankan retest.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Temuan Mendesak (≤3 hari atau lewat tenggat)</CardTitle></CardHeader>
        <CardContent>
          {urgent.length === 0 ? (
            <EmptyState title="Tidak ada temuan mendesak" description="Semua temuan terbuka masih punya waktu perbaikan yang cukup." />
          ) : (
            <ul className="flex flex-col gap-2">
              {urgent.map((f) => {
                const tone = dueTone(f);
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/findings/${f.id}`} className="text-foreground hover:underline">{f.title}</Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{f.app.name}</span>
                      <SeverityBadge severity={f.severity} />
                      <span className={cn("text-xs font-data", tone === "overdue" ? "text-danger" : "text-warning")}>
                        {f.dueDate ? formatDate(f.dueDate) : "-"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <ErrorState description="Gagal memuat papan perbaikan." onRetry={() => mutate()} />
      ) : items.length === 0 ? (
        <EmptyState title="Belum ada temuan" description="Papan akan terisi setelah ada temuan resmi dari triage atau input manual." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const colItems = items.filter((f) => f.status === col.key);
            return (
              <div key={col.key} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                  <Badge variant="muted">{colItems.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {colItems.length === 0 ? (
                    <p className="text-xs text-muted">Tidak ada temuan.</p>
                  ) : (
                    colItems.map((f) => <FindingKanbanCard key={f.id} f={f} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
