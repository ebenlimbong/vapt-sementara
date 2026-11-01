"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  mfaEnabled: boolean;
  createdAt: string;
  _count: { assignments: number };
};

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  function reset() {
    setName(""); setEmail(""); setPassword(""); setError(""); setGenerated(null);
  }

  async function submit() {
    setError("");
    if (!name.trim() || !email.trim()) {
      setError("Nama dan email wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: password.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal menambah pengguna.");
        return;
      }
      onCreated();
      if (json.temporaryPassword) {
        setGenerated(json.temporaryPassword);
      } else {
        setOpen(false);
        reset();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">Tambah Pengguna</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <div className="mb-4 flex flex-col gap-1">
          <DialogTitle>Tambah Pengguna</DialogTitle>
          <DialogDescription>Kosongkan kata sandi untuk membuat kata sandi sementara acak (ditampilkan sekali).</DialogDescription>
        </div>

        {generated ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">Pengguna berhasil dibuat. Kata sandi sementara (catat sekarang, tidak akan ditampilkan lagi):</p>
            <p className="rounded-md border border-border bg-surface-2 p-2 text-center font-data text-sm text-foreground">{generated}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <Label>Nama</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Kata Sandi (opsional)</Label>
              <Input type="text" className="font-data" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kosongkan untuk generate otomatis" />
            </div>
            <FieldError>{error}</FieldError>
          </div>
        )}

        <DialogFooter>
          {generated ? (
            <Button size="sm" onClick={() => { setOpen(false); reset(); }}>Tutup</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button size="sm" disabled={submitting} onClick={submit}>{submitting ? "Menyimpan..." : "Simpan"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}) }).toString();
  const { data, error, isLoading, mutate } = useSWR<{ items: UserRow[]; error?: string }>(`/api/admin/users?${query}`, fetcher);

  async function toggleStatus(u: UserRow) {
    const next = u.status === "active" ? "inactive" : "active";
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    if (!res.ok) alert(json.error ?? "Gagal mengubah status pengguna.");
    mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pengguna & Peran</h1>
          <p className="text-sm text-muted">Kelola akun pengguna; atur peran per aplikasi dari halaman detail pengguna.</p>
        </div>
        <NewUserDialog onCreated={() => mutate()} />
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CardTitle>Daftar Pengguna</CardTitle>
          <div className="flex w-full gap-2 sm:w-auto">
            <Input placeholder="Cari nama/email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={5} />
          ) : error || data?.error ? (
            <ErrorState description={data?.error ?? "Gagal memuat daftar pengguna."} onRetry={() => mutate()} />
          ) : data!.items.length === 0 ? (
            <EmptyState title="Tidak ada pengguna" description="Tambahkan pengguna baru lewat tombol di atas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Nama</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">MFA</th>
                    <th className="py-2 pr-4">Penugasan</th>
                    <th className="py-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link href={`/admin/users/${u.id}`} className="text-foreground hover:underline">{u.name}</Link>
                      </td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{u.email}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={u.status === "active" ? "success" : "muted"}>{u.status === "active" ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted">{u.mfaEnabled ? "Aktif" : "-"}</td>
                      <td className="py-2 pr-4 text-muted">{u._count.assignments} peran</td>
                      <td className="py-2 pr-4">
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(u)}>
                          {u.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
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
