"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Jam dinding dibaca via useSyncExternalStore (bukan Date.now() langsung saat
// render, dan bukan setState di dalam efek) supaya komponen tetap murni sesuai
// aturan React — dipakai untuk status jendela waktu tes (aktif/berakhir).
function subscribeClock(callback: () => void) {
  const id = setInterval(callback, 30000);
  return () => clearInterval(id);
}
function getClockSnapshot() {
  return Date.now();
}
function getClockServerSnapshot() {
  return 0;
}
function useNow() {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getClockServerSnapshot);
}

const STATUS_LABEL: Record<string, string> = {
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  berjalan: "Berjalan",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

type ScopeContent = {
  targetUrl?: string;
  allowedHosts?: string[];
  pagesOrEndpoints?: string[];
  testAccounts?: string;
  constraints?: string;
};

type Approval = {
  id: string;
  decision: "approved" | "rejected";
  reason: string | null;
  decidedAt: string;
  approver: { id: string; name: string };
};

type ScopeVersion = {
  id: string;
  versionNo: number;
  content: ScopeContent;
  diffSummary: unknown | null;
  isFinal: boolean;
  createdAt: string;
  creator: { id: string; name: string };
  approvals: Approval[];
};

type TestWindow = {
  id: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
};

type Detail = {
  currentUserId: string;
  item: {
    id: string;
    purpose: string;
    targetUrl: string;
    status: string;
    desiredStart: string;
    desiredEnd: string;
    createdAt: string;
    app: { id: string; name: string; category: string; baseUrl: string; environment: string };
    requester: { id: string; name: string; email: string };
  };
  scopeVersions: ScopeVersion[];
  testWindows: TestWindow[];
  myRoles: string[];
};

function ScopeContentView({ content }: { content: ScopeContent }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      <div>
        <dt className="text-muted">Target URL</dt>
        <dd className="font-data text-foreground">{content.targetUrl || "-"}</dd>
      </div>
      <div>
        <dt className="text-muted">Host yang diizinkan</dt>
        <dd className="font-data text-foreground">{(content.allowedHosts ?? []).join(", ") || "-"}</dd>
      </div>
      <div>
        <dt className="text-muted">Halaman/endpoint</dt>
        <dd className="font-data text-foreground">{(content.pagesOrEndpoints ?? []).join(", ") || "-"}</dd>
      </div>
      <div>
        <dt className="text-muted">Akun uji</dt>
        <dd className="text-foreground">{content.testAccounts || "-"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-muted">Batasan</dt>
        <dd className="text-foreground">{content.constraints || "-"}</dd>
      </div>
    </dl>
  );
}

function NewScopeVersionDialog({ requestId, onCreated }: { requestId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [allowedHosts, setAllowedHosts] = useState("");
  const [pages, setPages] = useState("");
  const [testAccounts, setTestAccounts] = useState("");
  const [constraints, setConstraints] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTargetUrl(""); setAllowedHosts(""); setPages(""); setTestAccounts(""); setConstraints(""); setError("");
  }

  async function submit() {
    setError("");
    const hosts = allowedHosts.split("\n").map((s) => s.trim()).filter(Boolean);
    const pagesArr = pages.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!targetUrl.trim() || hosts.length === 0) {
      setError("Target URL dan minimal satu host yang diizinkan wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/scope-versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          allowedHosts: hosts,
          pagesOrEndpoints: pagesArr,
          testAccounts,
          constraints,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal membuat versi ruang lingkup.");
        return;
      }
      reset();
      setOpen(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Buat Versi Baru</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <div className="mb-4 flex flex-col gap-1">
          <DialogTitle>Susun Ruang Lingkup Versi Baru</DialogTitle>
          <DialogDescription>Versi baru otomatis dibandingkan (diff) dengan versi sebelumnya.</DialogDescription>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <Label>Target URL</Label>
            <Input className="font-data" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Host yang diizinkan (satu per baris)</Label>
            <Textarea rows={2} className="font-data" value={allowedHosts} onChange={(e) => setAllowedHosts(e.target.value)} placeholder={"app.lab.internal\napi.lab.internal"} />
          </div>
          <div>
            <Label>Halaman / endpoint dalam cakupan (satu per baris)</Label>
            <Textarea rows={2} className="font-data" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={"/login\n/api/v1/users"} />
          </div>
          <div>
            <Label>Akun uji</Label>
            <Textarea rows={2} value={testAccounts} onChange={(e) => setTestAccounts(e.target.value)} placeholder="Deskripsi akun uji yang dipakai (role, sumber kredensial di vault, dsb.)" />
          </div>
          <div>
            <Label>Batasan Uji</Label>
            <Textarea rows={2} value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="Mis. tidak boleh DoS/brute force, hanya jam kerja, dsb." />
          </div>
          <FieldError>{error}</FieldError>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" disabled={submitting} onClick={submit}>{submitting ? "Menyimpan..." : "Simpan Versi"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalPanel({
  version,
  currentUserId,
  onDecided,
}: {
  version: ScopeVersion;
  currentUserId: string;
  onDecided: () => void;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSelf = version.creator.id === currentUserId;

  async function submit() {
    setError("");
    if (decision === "rejected" && !reason.trim()) {
      setError("Alasan wajib diisi saat menolak.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/scope-versions/${version.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal mengirim keputusan.");
        return;
      }
      onDecided();
    } finally {
      setSubmitting(false);
    }
  }

  if (isSelf) {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
        Anda tidak dapat menyetujui ruang lingkup yang Anda buat sendiri (pemisahan tugas). Minta Coordinator lain untuk memutuskan versi ini.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium text-foreground">Keputusan Persetujuan — v{version.versionNo}</p>
      <Select value={decision} onChange={(e) => setDecision(e.target.value as "approved" | "rejected")} className="w-48">
        <option value="approved">Setujui</option>
        <option value="rejected">Tolak</option>
      </Select>
      <Textarea rows={2} placeholder="Alasan (wajib bila menolak)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <FieldError>{error}</FieldError>
      <div>
        <Button size="sm" variant={decision === "rejected" ? "danger" : "success"} disabled={submitting} onClick={submit}>
          {submitting ? "Mengirim..." : decision === "rejected" ? "Tolak Ruang Lingkup" : "Setujui Ruang Lingkup"}
        </Button>
      </div>
    </div>
  );
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR<Detail & { error?: string }>(`/api/requests/${id}`, fetcher, {
    refreshInterval: 10000,
  });
  const { data: permission, mutate: mutatePermission } = useSWR(`/api/requests/${id}/scan-permission`, fetcher, {
    refreshInterval: 10000,
  });

  const now = useNow();

  if (isLoading) return <LoadingState rows={6} />;
  if (error || data?.error) {
    return <ErrorState description={data?.error ?? "Gagal memuat detail permintaan."} onRetry={() => mutate()} />;
  }
  if (!data) return null;

  const { item, scopeVersions, testWindows, myRoles, currentUserId } = data;
  const isTester = myRoles.includes("tester");
  const isCoordinator = myRoles.includes("coordinator");

  const latest = scopeVersions[scopeVersions.length - 1];
  const latestHasDecision = latest ? latest.approvals.length > 0 : false;
  const activeWindow = testWindows.find((w) => w.isActive) ?? testWindows[0];
  const windowStatus =
    activeWindow && now > 0
      ? now < new Date(activeWindow.startAt).getTime()
        ? "belum-mulai"
        : now > new Date(activeWindow.endAt).getTime()
        ? "berakhir"
        : activeWindow.isActive
        ? "aktif"
        : "nonaktif"
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/requests" className="text-xs text-muted hover:underline">&larr; Kembali ke daftar permintaan</Link>
          <h1 className="text-xl font-semibold text-foreground">{item.app.name}</h1>
          <p className="text-sm text-muted">{item.purpose}</p>
        </div>
        <Badge variant={item.status === "disetujui" || item.status === "selesai" ? "success" : item.status === "ditolak" ? "danger" : "default"}>
          {STATUS_LABEL[item.status] ?? item.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Info Permintaan</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted">Target URL</dt><dd className="font-data text-foreground">{item.targetUrl}</dd></div>
              <div><dt className="text-xs text-muted">Pengaju</dt><dd className="text-foreground">{item.requester.name}</dd></div>
              <div><dt className="text-xs text-muted">Waktu Mulai Diinginkan</dt><dd className="font-data text-foreground">{formatDateTime(item.desiredStart)}</dd></div>
              <div><dt className="text-xs text-muted">Waktu Selesai Diinginkan</dt><dd className="font-data text-foreground">{formatDateTime(item.desiredEnd)}</dd></div>
              <div><dt className="text-xs text-muted">Diajukan</dt><dd className="font-data text-foreground">{formatDateTime(item.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted">Peran Anda di Aplikasi Ini</dt><dd className="text-foreground">{myRoles.length ? myRoles.join(", ") : "-"}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Jendela Waktu Tes</CardTitle></CardHeader>
          <CardContent>
            {!activeWindow ? (
              <EmptyState title="Belum ada jendela waktu" description="Terbentuk otomatis begitu scope disetujui Coordinator." />
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                {windowStatus === null ? (
                  <Badge variant="muted">Memuat...</Badge>
                ) : (
                  <Badge variant={windowStatus === "aktif" ? "success" : windowStatus === "berakhir" ? "muted" : "warning"}>
                    {windowStatus === "aktif" ? "Aktif" : windowStatus === "berakhir" ? "Berakhir" : windowStatus === "belum-mulai" ? "Belum Mulai" : "Nonaktif"}
                  </Badge>
                )}
                <p className="font-data text-xs text-muted">{formatDateTime(activeWindow.startAt)} s.d. {formatDateTime(activeWindow.endAt)}</p>
                <div className="mt-2 border-t border-border pt-2">
                  <p className="text-xs text-muted">Status Izin Scan</p>
                  {!permission ? (
                    <p className="text-xs text-muted">Memuat...</p>
                  ) : permission.allowed ? (
                    <p className="text-xs text-success">Scan diizinkan pada jendela ini.</p>
                  ) : (
                    <p className="text-xs text-danger">{permission.reason}</p>
                  )}
                  <button onClick={() => mutatePermission()} className="mt-1 text-xs text-accent underline">Cek ulang</button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
          <CardTitle>Ruang Lingkup Berversi</CardTitle>
          <div className="flex gap-2">
            {isTester && <NewScopeVersionDialog requestId={item.id} onCreated={() => mutate()} />}
            {isTester && latest && !latest.isFinal && !latestHasDecision && (
              <Button
                size="sm"
                onClick={async () => {
                  const res = await fetch(`/api/requests/${item.id}/scope-versions/${latest.id}/finalize`, { method: "POST" });
                  const json = await res.json();
                  if (!res.ok) alert(json.error ?? "Gagal menandai final.");
                  mutate();
                }}
              >
                Tandai Final & Kirim Persetujuan
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {scopeVersions.length === 0 ? (
            <EmptyState title="Belum ada ruang lingkup" description="Tester belum menyusun versi ruang lingkup untuk permintaan ini." />
          ) : (
            <div className="flex flex-col gap-4">
              {[...scopeVersions].reverse().map((v) => (
                <div key={v.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-data text-sm font-semibold text-foreground">v{v.versionNo}</span>
                      {v.isFinal && <Badge variant="warning">Final</Badge>}
                      {v.approvals.map((a) => (
                        <Badge key={a.id} variant={a.decision === "approved" ? "success" : "danger"}>
                          {a.decision === "approved" ? "Disetujui" : "Ditolak"} oleh {a.approver.name}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted">{v.creator.name} &middot; {formatDateTime(v.createdAt)}</span>
                  </div>

                  <div className="mt-3">
                    <ScopeContentView content={v.content} />
                  </div>

                  <div className="mt-3 border-t border-border pt-2">
                    <p className="text-xs text-muted">Perbedaan dari versi sebelumnya</p>
                    {v.diffSummary ? (
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface-2 p-2 font-data text-[11px] text-foreground">
                        {JSON.stringify(v.diffSummary, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted">{v.versionNo === 1 ? "Versi pertama — tidak ada pembanding." : "Tidak ada perubahan terdeteksi."}</p>
                    )}
                  </div>

                  {v.approvals.map((a) => a.reason && (
                    <p key={a.id} className="mt-2 text-xs text-muted">Alasan {a.decision === "rejected" ? "penolakan" : "persetujuan"}: {a.reason}</p>
                  ))}

                  {isCoordinator && v.isFinal && v.approvals.length === 0 && (
                    <div className="mt-3">
                      <ApprovalPanel version={v} currentUserId={currentUserId} onDecided={() => { mutate(); mutatePermission(); }} />
                    </div>
                  )}

                  {!v.isFinal && v.id === latest?.id && !isTester && (
                    <p className="mt-2 text-xs text-muted">Menunggu Tester menandai versi ini final sebelum bisa disetujui.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
