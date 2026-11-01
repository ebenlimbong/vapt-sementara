"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABEL: Record<string, string> = { technical: "Teknis", executive: "Eksekutif" };

type ReportItem = {
  id: string;
  reportType: "technical" | "executive";
  sha256: string;
  createdAt: string;
  app: { id: string; name: string };
  generator: { id: string; name: string };
};

export default function ReportsPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/reports", fetcher, { refreshInterval: 15000 });
  const { data: appsData } = useSWR("/api/findings/apps", fetcher);
  const testerApps: { id: string; name: string; roles: string[] }[] = (appsData?.items ?? []).filter((a: { roles: string[] }) =>
    a.roles.includes("tester")
  );

  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [reportType, setReportType] = useState<"technical" | "executive">("technical");
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: requestsData } = useSWR(appId ? `/api/reports/requests?appId=${appId}` : null, fetcher);
  const requests: { id: string; purpose: string; status: string; createdAt: string }[] = requestsData?.items ?? [];

  function openDialog() {
    setAppId("");
    setRequestId("");
    setReportType("technical");
    setGenError(null);
    setOpen(true);
  }

  async function generate() {
    if (!requestId) {
      setGenError("Pilih permintaan uji terlebih dahulu.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, reportType }),
    });
    const json = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) {
      setGenError(json.error ?? "Gagal membuat laporan.");
      return;
    }
    setOpen(false);
    await mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Laporan PDF</h1>
          <p className="text-sm text-muted">Buat dan unduh laporan teknis & eksekutif. Data sensitif otomatis disamarkan sebelum dicetak.</p>
        </div>
        <Button onClick={openDialog}>+ Buat Laporan</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Laporan</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={5} />
          ) : error ? (
            <ErrorState description="Gagal memuat daftar laporan." onRetry={() => mutate()} />
          ) : data.items.length === 0 ? (
            <EmptyState title="Belum ada laporan" description="Buat laporan pertama dari tombol di atas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Jenis</th>
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Dibuat Oleh</th>
                    <th className="py-2 pr-4">Waktu</th>
                    <th className="py-2 pr-4">SHA-256</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {(data.items as ReportItem[]).map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-4"><Badge>{TYPE_LABEL[r.reportType]}</Badge></td>
                      <td className="py-2 pr-4 text-foreground">{r.app.name}</td>
                      <td className="py-2 pr-4 text-foreground">{r.generator.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(r.createdAt)}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{r.sha256.slice(0, 12)}...</td>
                      <td className="py-2 pr-4">
                        <a href={`/api/reports/${r.id}/download`} className="text-xs text-accent underline">Unduh</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Buat Laporan Baru</DialogTitle>
          <DialogDescription>Pilih permintaan uji dan jenis laporan. Data temuan saat ini akan dibekukan ke dalam PDF.</DialogDescription>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="app">Aplikasi</Label>
              <Select id="app" value={appId} onChange={(e) => { setAppId(e.target.value); setRequestId(""); }}>
                <option value="">Pilih aplikasi...</option>
                {testerApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="request">Permintaan Uji</Label>
              <Select id="request" value={requestId} onChange={(e) => setRequestId(e.target.value)} disabled={!appId}>
                <option value="">Pilih permintaan...</option>
                {requests.map((r) => <option key={r.id} value={r.id}>{r.purpose} ({r.status})</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Jenis Laporan</Label>
              <Select id="type" value={reportType} onChange={(e) => setReportType(e.target.value as "technical" | "executive")}>
                <option value="technical">Teknis</option>
                <option value="executive">Eksekutif</option>
              </Select>
            </div>
            {genError && <p className="text-xs text-danger">{genError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={generate} disabled={generating}>{generating ? "Membuat..." : "Buat & Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
