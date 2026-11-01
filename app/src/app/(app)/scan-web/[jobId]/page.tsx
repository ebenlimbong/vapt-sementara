"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const JOB_STATUS_LABEL: Record<string, string> = {
  queued: "Menunggu",
  running: "Berjalan",
  done: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

const JOB_STATUS_VARIANT: Record<string, "default" | "outline" | "success" | "warning" | "danger" | "muted"> = {
  queued: "muted",
  running: "warning",
  done: "success",
  failed: "danger",
  cancelled: "outline",
};

const JOB_TYPE_LABEL: Record<string, string> = {
  web_scan: "Scan Web",
  retest: "Retest",
  api_access_test: "Uji Akses API",
};

const STAGE_STATUS_LABEL: Record<string, string> = {
  belum_berjalan: "Belum Berjalan",
  berjalan: "Berjalan",
  selesai: "Selesai",
  gagal: "Gagal",
  dihentikan: "Dihentikan",
};

const STAGE_STATUS_VARIANT: Record<string, "default" | "outline" | "success" | "warning" | "danger" | "muted"> = {
  belum_berjalan: "muted",
  berjalan: "warning",
  selesai: "success",
  gagal: "danger",
  dihentikan: "outline",
};

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  terverifikasi_jadi_temuan: "Terverifikasi jadi Temuan",
  alarm_palsu: "Alarm Palsu",
};

type Stage = { stage: string; status: string; message: string | null; updatedAt: string | null };
type Candidate = { id: string; title: string; category: string; status: string; createdAt: string };

type JobDetail = {
  id: string;
  jobType: string;
  status: string;
  currentStage: string | null;
  progressPct: number;
  cancelRequested: boolean;
  failureReason: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  queuePosition: number | null;
  canCancel: boolean;
  requestId: string;
  app: { id: string; name: string };
  requester: { id: string; name: string };
  creator: { id: string; name: string };
  scope: { scopeVersionId: string; versionNo: number; targetUrl: string; allowedHosts: string[]; failedEventCount: number };
  stages: Stage[];
  candidates: Candidate[];
};

export default function ScanWebJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: job, error, isLoading, mutate } = useSWR<JobDetail>(
    jobId ? `/api/scan-web/jobs/${jobId}` : null,
    fetcher,
    {
      refreshInterval: (latest) =>
        latest && (latest.status === "queued" || latest.status === "running") ? 2000 : 0,
    }
  );

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/scan-web/jobs/${jobId}/cancel`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? "Gagal menghentikan scan.");
        return;
      }
      setCancelOpen(false);
      await mutate();
    } catch {
      setCancelError("Gagal menghubungi server.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/scan-web" className="text-xs text-muted hover:underline">
            &larr; Kembali ke Scan Otomatis Web
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Detail Job Scan</h1>
        </div>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <ErrorState description="Gagal memuat detail job." onRetry={() => mutate()} />
      ) : !job ? (
        <EmptyState title="Job tidak ditemukan" description="Job scan ini mungkin sudah dihapus atau tidak ada." />
      ) : (
        <>
          <Card>
            <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{job.app.name}</CardTitle>
                  <Badge variant="outline">{JOB_TYPE_LABEL[job.jobType] ?? job.jobType}</Badge>
                  <Badge variant={JOB_STATUS_VARIANT[job.status] ?? "default"}>
                    {JOB_STATUS_LABEL[job.status] ?? job.status}
                  </Badge>
                </div>
                <p className="font-data text-xs text-muted">{job.scope.targetUrl}</p>
              </div>
              {job.canCancel && (
                <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                  <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                    Hentikan Scan
                  </Button>
                  <DialogContent>
                    <DialogTitle>Hentikan scan ini?</DialogTitle>
                    <DialogDescription>
                      Scan untuk <span className="font-data">{job.scope.targetUrl}</span> akan dihentikan dengan aman.
                      Tahap yang sedang berjalan akan berhenti dan tidak ada tahap baru yang dimulai. Tindakan ini
                      akan tercatat di jejak audit.
                    </DialogDescription>
                    {cancelError && <p className="mt-2 text-xs text-danger">{cancelError}</p>}
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline" size="sm" disabled={cancelling}>
                          Batal
                        </Button>
                      </DialogClose>
                      <Button variant="danger" size="sm" onClick={handleCancel} disabled={cancelling}>
                        {cancelling ? "Menghentikan..." : "Ya, Hentikan"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-full rounded-full bg-surface-2">
                  <div
                    className="h-2 rounded-full bg-accent transition-all"
                    style={{ width: `${job.progressPct}%` }}
                  />
                </div>
                <span className="font-data text-xs text-muted">{job.progressPct}%</span>
              </div>
              <p className="font-data text-xs text-muted">
                Tahap saat ini: {job.currentStage ?? "menunggu antrean"}
                {job.status === "queued" && job.queuePosition && ` · posisi antrean #${job.queuePosition}`}
              </p>
              {job.failureReason && <p className="text-xs text-danger">Gagal: {job.failureReason}</p>}
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-3">
                <span>Peminta tes: {job.requester.name}</span>
                <span>Dijalankan oleh: {job.creator.name}</span>
                <span>Diminta: {formatDateTime(job.queuedAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress per Tahap</CardTitle>
            </CardHeader>
            <CardContent>
              {job.stages.length === 0 ? (
                <EmptyState title="Belum ada tahap" description="Tahap pemeriksaan akan muncul saat job mulai diproses worker." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {job.stages.map((s) => (
                    <li key={s.stage} className="flex flex-col gap-1 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-data text-sm text-foreground">{s.stage}</p>
                        {s.message && <p className="text-xs text-muted">{s.message}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {s.updatedAt && <span className="font-data text-xs text-muted">{formatDateTime(s.updatedAt)}</span>}
                        <Badge variant={STAGE_STATUS_VARIANT[s.status] ?? "default"}>
                          {STAGE_STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cakupan Pemeriksaan</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="text-xs text-muted">Target utama</p>
                <p className="font-data text-sm text-foreground">{job.scope.targetUrl}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Host yang diizinkan (allowlist)</p>
                {job.scope.allowedHosts.length === 0 ? (
                  <p className="text-xs text-muted">Tidak ada host tambahan — hanya host dari target &amp; aplikasi.</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {job.scope.allowedHosts.map((h) => (
                      <Badge key={h} variant="outline" className="font-data">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted">Indikasi upaya keluar target / error tahap</p>
                <p className="text-sm text-foreground">
                  {job.scope.failedEventCount === 0
                    ? "Tidak ada kegagalan tahap tercatat."
                    : `${job.scope.failedEventCount} event berstatus gagal — periksa detail tahap di atas (bisa jadi upaya keluar target yang diblokir anti-SSRF, atau error jaringan biasa).`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kandidat Temuan</CardTitle>
            </CardHeader>
            <CardContent>
              {job.candidates.length === 0 ? (
                <EmptyState
                  title="Belum ada kandidat"
                  description="Kandidat temuan mentah dari scan ini akan muncul di sini. Kandidat bukan temuan resmi sampai diverifikasi di modul Triage."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted">
                        <th className="py-2 pr-4">Judul</th>
                        <th className="py-2 pr-4">Kategori</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.candidates.map((c) => (
                        <tr key={c.id} className="border-b border-border/60">
                          <td className="py-2 pr-4 text-foreground">{c.title}</td>
                          <td className="py-2 pr-4 font-data text-xs text-muted">{c.category}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={c.status === "terverifikasi_jadi_temuan" ? "success" : c.status === "alarm_palsu" ? "muted" : "default"}>
                              {CANDIDATE_STATUS_LABEL[c.status] ?? c.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Link href={`/triage?jobId=${job.id}`} className="mt-3 inline-block text-xs text-accent underline">
                    Lihat di Triage
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
