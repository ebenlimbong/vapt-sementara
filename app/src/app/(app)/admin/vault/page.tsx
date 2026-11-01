"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type VaultRow = {
  id: string;
  label: string;
  maskedValue: string;
  app: { id: string; name: string };
  creator: { id: string; name: string };
  testAccount: { id: string; roleLabel: string } | null;
  createdAt: string;
};

type AppOption = { id: string; name: string };

function NewCredentialDialog({ apps, onSaved }: { apps: AppOption[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() { setAppId(""); setLabel(""); setValue(""); setError(""); }

  async function submit() {
    setError("");
    if (!appId || !label.trim() || !value) {
      setError("Aplikasi, label, dan nilai kredensial wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, label, value }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal menyimpan kredensial.");
        return;
      }
      reset();
      setOpen(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">Tambah Kredensial</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <div className="mb-4 flex flex-col gap-1">
          <DialogTitle>Tambah Kredensial Uji</DialogTitle>
          <DialogDescription>Nilai dienkripsi sebelum disimpan dan tidak akan pernah ditampilkan mentah lagi.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Aplikasi</Label>
            <Select value={appId} onChange={(e) => setAppId(e.target.value)}>
              <option value="">Pilih aplikasi...</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mis. akun tester role user biasa" />
          </div>
          <div>
            <Label>Nilai Kredensial</Label>
            <Input type="password" className="font-data" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" disabled={submitting} onClick={submit}>{submitting ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceCredentialDialog({ row, onSaved }: { row: VaultRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(row.label);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError("");
    if (!label.trim() && !value) {
      setError("Isi label baru dan/atau nilai baru.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/vault/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label !== row.label ? label : undefined, value: value || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal mengganti kredensial.");
        return;
      }
      setValue("");
      setOpen(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Ganti</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <div className="mb-4 flex flex-col gap-1">
          <DialogTitle>Ganti Kredensial — {row.app.name}</DialogTitle>
          <DialogDescription>Nilai lama tidak bisa dilihat lagi; ini mengganti sepenuhnya dengan nilai baru.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <Label>Nilai Baru (kosongkan bila hanya mengubah label)</Label>
            <Input type="password" className="font-data" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" disabled={submitting} onClick={submit}>{submitting ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminVaultPage() {
  const { data, error, isLoading, mutate } = useSWR<{ items: VaultRow[]; error?: string }>("/api/admin/vault", fetcher);
  const { data: apps } = useSWR<{ items: AppOption[]; error?: string }>("/api/admin/applications", fetcher);
  const appOptions = apps?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vault Kredensial</h1>
          <p className="text-sm text-muted">Kredensial uji tersimpan terenkripsi dan tidak pernah ditampilkan mentah.</p>
        </div>
        <NewCredentialDialog apps={appOptions} onSaved={() => mutate()} />
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Kredensial</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={4} />
          ) : error || data?.error ? (
            <ErrorState description={data?.error ?? "Gagal memuat daftar kredensial."} onRetry={() => mutate()} />
          ) : data!.items.length === 0 ? (
            <EmptyState title="Belum ada kredensial" description="Tambahkan kredensial uji pertama lewat tombol di atas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Label</th>
                    <th className="py-2 pr-4">Nilai</th>
                    <th className="py-2 pr-4">Dibuat Oleh</th>
                    <th className="py-2 pr-4">Dibuat</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4 text-foreground">{c.app.name}</td>
                      <td className="py-2 pr-4 text-muted">{c.label}</td>
                      <td className="py-2 pr-4"><Badge variant="muted" className="font-data">{c.maskedValue}</Badge></td>
                      <td className="py-2 pr-4 text-muted">{c.creator.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(c.createdAt)}</td>
                      <td className="py-2 pr-4"><ReplaceCredentialDialog row={c} onSaved={() => mutate()} /></td>
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
