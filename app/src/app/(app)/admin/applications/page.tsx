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

type AppRow = {
  id: string;
  name: string;
  baseUrl: string;
  category: "web" | "api";
  environment: "staging" | "lab";
  owner: { id: string; name: string } | null;
  createdAt: string;
};

type OwnerOption = { id: string; name: string; email: string };

function AppFormDialog({
  trigger,
  initial,
  owners,
  onSaved,
}: {
  trigger: React.ReactNode;
  initial?: AppRow;
  owners: OwnerOption[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [category, setCategory] = useState<"web" | "api">(initial?.category ?? "web");
  const [environment, setEnvironment] = useState<"staging" | "lab">(initial?.environment ?? "staging");
  const [ownerId, setOwnerId] = useState(initial?.owner?.id ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError("");
    if (!name.trim() || !baseUrl.trim()) {
      setError("Nama dan Base URL wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(initial ? `/api/admin/applications/${initial.id}` : "/api/admin/applications", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baseUrl, category, environment, ownerId: ownerId || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal menyimpan aplikasi.");
        return;
      }
      setOpen(false);
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="mb-4 flex flex-col gap-1">
          <DialogTitle>{initial ? "Ubah Aplikasi" : "Tambah Aplikasi"}</DialogTitle>
          <DialogDescription>Aplikasi menjadi dasar RBAC per-aplikasi (penugasan peran, scope, scan, temuan).</DialogDescription>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Nama Aplikasi</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Base URL</Label>
            <Input className="font-data" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://juice-shop:3000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategori</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value as "web" | "api")}>
                <option value="web">Web</option>
                <option value="api">API</option>
              </Select>
            </div>
            <div>
              <Label>Environment</Label>
              <Select value={environment} onChange={(e) => setEnvironment(e.target.value as "staging" | "lab")}>
                <option value="staging">Staging</option>
                <option value="lab">Lab</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Owner (App Owner)</Label>
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Belum ditentukan</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.email})</option>
              ))}
            </Select>
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

export default function AdminApplicationsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ items: AppRow[]; error?: string }>("/api/admin/applications", fetcher);
  const { data: users } = useSWR<{ items: OwnerOption[]; error?: string }>("/api/admin/users", fetcher);
  const owners = users?.items ?? [];

  async function remove(row: AppRow) {
    if (!confirm(`Hapus aplikasi "${row.name}"? Semua data terkait (permintaan, scope, temuan) ikut terhapus.`)) return;
    const res = await fetch(`/api/admin/applications/${row.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) alert(json.error ?? "Gagal menghapus aplikasi.");
    mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Aplikasi</h1>
          <p className="text-sm text-muted">Kelola aplikasi target VAPT (web/API, staging/lab).</p>
        </div>
        <AppFormDialog trigger={<Button size="sm">Tambah Aplikasi</Button>} owners={owners} onSaved={() => mutate()} />
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Aplikasi</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={4} />
          ) : error || data?.error ? (
            <ErrorState description={data?.error ?? "Gagal memuat daftar aplikasi."} onRetry={() => mutate()} />
          ) : data!.items.length === 0 ? (
            <EmptyState title="Belum ada aplikasi" description="Tambahkan aplikasi pertama lewat tombol di atas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Nama</th>
                    <th className="py-2 pr-4">Base URL</th>
                    <th className="py-2 pr-4">Kategori</th>
                    <th className="py-2 pr-4">Environment</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Dibuat</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4 text-foreground">{a.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{a.baseUrl}</td>
                      <td className="py-2 pr-4"><Badge variant="outline">{a.category}</Badge></td>
                      <td className="py-2 pr-4"><Badge variant="muted">{a.environment}</Badge></td>
                      <td className="py-2 pr-4 text-muted">{a.owner?.name ?? "-"}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(a.createdAt)}</td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-2">
                          <AppFormDialog
                            trigger={<Button size="sm" variant="outline">Ubah</Button>}
                            initial={a}
                            owners={owners}
                            onSaved={() => mutate()}
                          />
                          <Button size="sm" variant="danger" onClick={() => remove(a)}>Hapus</Button>
                        </div>
                      </td>
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
