"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select, Textarea, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_LABEL: Record<string, string> = {
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  berjalan: "Berjalan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

type EligibleApp = { id: string; name: string; category: string; environment: string };

function NewRequestDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: eligible } = useSWR<{ items: EligibleApp[] }>(open ? "/api/requests/eligible-apps" : null, fetcher);

  const [appId, setAppId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [desiredStart, setDesiredStart] = useState("");
  const [desiredEnd, setDesiredEnd] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setAppId("");
    setPurpose("");
    setTargetUrl("");
    setDesiredStart("");
    setDesiredEnd("");
    setError("");
  }

  async function submit() {
    setError("");
    if (!appId || !purpose.trim() || !targetUrl.trim() || !desiredStart || !desiredEnd) {
      setError("Semua field wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, purpose, targetUrl, desiredStart, desiredEnd }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal mengajukan permintaan.");
        return;
      }
      reset();
      setOpen(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  const apps = eligible?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">Ajukan Permintaan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="mb-4 flex flex-col gap-1">
          <DialogTitle>Ajukan Permintaan Uji Keamanan</DialogTitle>
          <DialogDescription>Isi target, tujuan, dan waktu yang diinginkan. Permintaan masuk ke antrean dengan status &quot;diajukan&quot;.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Aplikasi</Label>
            {eligible === undefined ? (
              <p className="text-xs text-muted">Memuat daftar aplikasi...</p>
            ) : apps.length === 0 ? (
              <p className="text-xs text-danger">Anda belum menjadi App Owner pada aplikasi mana pun — hubungi Admin untuk ditugaskan.</p>
            ) : (
              <Select value={appId} onChange={(e) => setAppId(e.target.value)}>
                <option value="">Pilih aplikasi...</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.category}/{a.environment})</option>
                ))}
              </Select>
            )}
          </div>
          <div>
            <Label>Tujuan Pengujian</Label>
            <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Mis. verifikasi keamanan sebelum rilis fitur login baru" />
          </div>
          <div>
            <Label>Target URL</Label>
            <Input className="font-data" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Waktu Mulai Diinginkan</Label>
              <Input type="datetime-local" value={desiredStart} onChange={(e) => setDesiredStart(e.target.value)} />
            </div>
            <div>
              <Label>Waktu Selesai Diinginkan</Label>
              <Input type="datetime-local" value={desiredEnd} onChange={(e) => setDesiredEnd(e.target.value)} />
            </div>
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" disabled={submitting || apps.length === 0} onClick={submit}>
            {submitting ? "Mengirim..." : "Ajukan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RequestsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const query = new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) }).toString();
  const { data, error, isLoading, mutate } = useSWR(`/api/requests?${query}`, fetcher, { refreshInterval: 8000 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Permintaan & Izin Tes</h1>
          <p className="text-sm text-muted">Alur pengajuan uji keamanan sampai izinnya disetujui.</p>
        </div>
        <NewRequestDialog onCreated={() => mutate()} />
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CardTitle>Daftar Permintaan</CardTitle>
          <div className="flex w-full gap-2 sm:w-auto">
            <Input placeholder="Cari aplikasi/tujuan/target..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">Semua status</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            {(search || status) && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatus(""); }}>Reset</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={5} />
          ) : error || data?.error ? (
            <ErrorState description={data?.error ?? "Gagal memuat daftar permintaan."} onRetry={() => mutate()} />
          ) : data.items.length === 0 ? (
            <EmptyState
              title={search || status ? "Tidak ada hasil yang cocok" : "Belum ada permintaan"}
              description={search || status ? "Coba ubah kata kunci atau filter." : "Ajukan permintaan uji pertama lewat tombol di atas."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Tujuan</th>
                    <th className="py-2 pr-4">Pengaju</th>
                    <th className="py-2 pr-4">Jendela Diinginkan</th>
                    <th className="py-2 pr-4">Diajukan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t: {
                    id: string; status: string; purpose: string; createdAt: string;
                    desiredStart: string; desiredEnd: string;
                    app: { id: string; name: string }; requester: { name: string };
                  }) => (
                    <tr key={t.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link href={`/requests/${t.id}`}>
                          <Badge variant={t.status === "selesai" || t.status === "disetujui" ? "success" : t.status === "ditolak" ? "danger" : "default"}>
                            {STATUS_LABEL[t.status] ?? t.status}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <Link href={`/requests/${t.id}`} className="text-foreground hover:underline">{t.app.name}</Link>
                      </td>
                      <td className="py-2 pr-4 text-muted">{t.purpose}</td>
                      <td className="py-2 pr-4 text-foreground">{t.requester.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(t.desiredStart)} s.d. {formatDateTime(t.desiredEnd)}</td>
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
