"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Select, Textarea, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDate, cn } from "@/lib/utils";
import {
  type Cvss4Metrics,
  REQUIRED_KEYS,
  computeScore,
  scoreToSeverity,
  buildVectorString,
  parseVectorString,
} from "@/lib/cvss4";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  dikerjakan: "Dikerjakan",
  menunggu_retest: "Menunggu Uji Ulang",
  selesai: "Selesai",
};

const CVSS_OPTIONS: Record<keyof Cvss4Metrics, string[]> = {
  AV: ["N", "A", "L", "P"],
  AC: ["L", "H"],
  AT: ["N", "P"],
  PR: ["N", "L", "H"],
  UI: ["N", "P", "A"],
  VC: ["H", "L", "N"],
  VI: ["H", "L", "N"],
  VA: ["H", "L", "N"],
  SC: ["H", "L", "N"],
  SI: ["H", "L", "N"],
  SA: ["H", "L", "N"],
};

const DEFAULT_METRICS: Partial<Cvss4Metrics> = {
  AV: "N", AC: "L", AT: "N", PR: "N", UI: "N", VC: "N", VI: "N", VA: "N", SC: "N", SI: "N", SA: "N",
};

type EvidenceItem = {
  id: string;
  versionNo: number;
  sha256: string;
  mimeType: string;
  createdAt: string;
  uploader: { id: string; name: string };
};

type RemediationEventItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  actor: { id: string; name: string };
};

type RetestItem = {
  id: string;
  result: string;
  note: string | null;
  createdAt: string;
  verifier: { id: string; name: string };
};

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, error, isLoading, mutate } = useSWR(`/api/findings/${id}`, fetcher);

  const [metrics, setMetrics] = useState<Partial<Cvss4Metrics>>(DEFAULT_METRICS);
  const [cvssError, setCvssError] = useState<string | null>(null);
  const [cvssSubmitting, setCvssSubmitting] = useState(false);
  const [metricsInit, setMetricsInit] = useState(false);

  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [respondError, setRespondError] = useState<string | null>(null);
  const [respondSubmitting, setRespondSubmitting] = useState(false);

  const [retestError, setRetestError] = useState<string | null>(null);
  const [retestSubmitting, setRetestSubmitting] = useState(false);
  const [retestNeedsManual, setRetestNeedsManual] = useState(false);

  if (isLoading) return <LoadingState rows={8} />;
  if (error || !data || data.error) return <ErrorState description={data?.error ?? "Gagal memuat temuan."} onRetry={() => mutate()} />;

  const finding = data.finding;
  const userRoles: string[] = data.userRoles ?? [];
  const isTester = userRoles.includes("tester");
  const isOwner = userRoles.includes("app_owner");

  if (!metricsInit && finding.cvssVector) {
    const parsed = parseVectorString(finding.cvssVector);
    if (parsed) {
      setMetrics(parsed);
    }
    setMetricsInit(true);
  }

  const fullMetrics = REQUIRED_KEYS.every((k) => metrics[k]) ? (metrics as Cvss4Metrics) : null;
  const preview = fullMetrics
    ? { score: computeScore(fullMetrics), severity: scoreToSeverity(computeScore(fullMetrics)), vector: buildVectorString(fullMetrics) }
    : null;

  const dueDate: Date | null = finding.dueDate ? new Date(finding.dueDate) : null;
  const now = new Date();
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const dueTone = finding.status === "selesai" || daysLeft === null
    ? "muted"
    : daysLeft < 0
      ? "overdue"
      : daysLeft <= 3
        ? "near"
        : "ok";

  async function submitCvss() {
    if (!fullMetrics) {
      setCvssError("Lengkapi semua 11 komponen CVSS sebelum menyimpan.");
      return;
    }
    setCvssSubmitting(true);
    setCvssError(null);
    const res = await fetch(`/api/findings/${id}/cvss`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullMetrics),
    });
    const json = await res.json().catch(() => ({}));
    setCvssSubmitting(false);
    if (!res.ok) {
      setCvssError(json.error ? `${json.error}${json.missing ? `: ${json.missing.join(", ")}` : ""}` : "Gagal menyimpan skor CVSS.");
      return;
    }
    await mutate();
  }

  async function submitEvidence(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setEvidenceError("Pilih berkas bukti terlebih dahulu.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setEvidenceUploading(true);
    setEvidenceError(null);
    const res = await fetch(`/api/findings/${id}/evidence`, { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setEvidenceUploading(false);
    if (!res.ok) {
      setEvidenceError(json.error ?? "Gagal mengunggah bukti.");
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    await mutate();
  }

  async function copySha(evidenceId: string, sha: string) {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedId(evidenceId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard tidak tersedia -> diamkan, user masih bisa lihat penuh via toggle
    }
  }

  async function submitRespond(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      ownerResponse: String(fd.get("ownerResponse") ?? ""),
      nextStatus: String(fd.get("nextStatus") ?? ""),
    };
    setRespondSubmitting(true);
    setRespondError(null);
    const res = await fetch(`/api/findings/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setRespondSubmitting(false);
    if (!res.ok) {
      setRespondError(json.error ?? "Gagal menyimpan tanggapan.");
      return;
    }
    await mutate();
  }

  async function submitRetest(body: Record<string, unknown>) {
    setRetestSubmitting(true);
    setRetestError(null);
    const res = await fetch(`/api/findings/${id}/retest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setRetestSubmitting(false);
    if (!res.ok) {
      if (/manual/i.test(json.error ?? "")) {
        setRetestNeedsManual(true);
      }
      setRetestError(json.error ?? "Gagal menjalankan retest.");
      return;
    }
    setRetestNeedsManual(false);
    await mutate();
  }

  async function submitManualRetest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await submitRetest({ result: String(fd.get("result") ?? ""), note: String(fd.get("note") ?? "") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{finding.title}</h1>
          <Badge variant={finding.candidateId ? "default" : "outline"}>{finding.candidateId ? "Dari Scan" : "Manual"}</Badge>
        </div>
        <p className="text-sm text-muted">{finding.app.name}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Info Temuan</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SeverityBadge severity={finding.severity} />
            <Badge>{STATUS_LABEL[finding.status] ?? finding.status}</Badge>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-data",
                dueTone === "overdue" && "border-danger/40 bg-danger/15 text-danger",
                dueTone === "near" && "border-warning/40 bg-warning/15 text-warning",
                dueTone === "ok" && "border-border text-muted",
                dueTone === "muted" && "border-border text-muted"
              )}
            >
              Tenggat: {dueDate ? formatDate(dueDate) : "-"}
              {dueTone === "overdue" && " (lewat tenggat)"}
              {dueTone === "near" && ` (${daysLeft} hari lagi)`}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Deskripsi</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{finding.description}</p>
          </div>
          {finding.steps && (
            <div>
              <p className="text-xs font-medium text-muted">Langkah Reproduksi</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{finding.steps}</p>
            </div>
          )}
          {finding.impact && (
            <div>
              <p className="text-xs font-medium text-muted">Dampak</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{finding.impact}</p>
            </div>
          )}
          <p className="font-data text-xs text-muted">Dibuat {formatDateTime(finding.createdAt)} oleh {finding.creator?.name}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kalkulator CVSS v4.0</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {REQUIRED_KEYS.map((key) => (
              <div key={key}>
                <Label htmlFor={`cvss-${key}`}>{key}</Label>
                <Select
                  id={`cvss-${key}`}
                  value={metrics[key] ?? ""}
                  onChange={(e) => setMetrics((m) => ({ ...m, [key]: e.target.value }))}
                  disabled={!isTester}
                >
                  <option value="" disabled>-</option>
                  {CVSS_OPTIONS[key].map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
            ))}
          </div>

          {preview && (
            <div className="flex items-center gap-4 rounded-md border border-border bg-surface-2 p-3">
              <span className="text-lg font-semibold font-data text-foreground">{preview.score.toFixed(1)}</span>
              <SeverityBadge severity={preview.severity} />
              <span className="font-data text-xs text-muted break-all">{preview.vector}</span>
            </div>
          )}

          {cvssError && <p className="text-xs text-danger">{cvssError}</p>}
          {!isTester && <p className="text-xs text-muted">Hanya Tester yang dapat menyimpan skor CVSS untuk aplikasi ini.</p>}

          {isTester && (
            <div>
              <Button onClick={submitCvss} disabled={cvssSubmitting || !fullMetrics}>
                {cvssSubmitting ? "Menyimpan..." : "Simpan Skor CVSS"}
              </Button>
            </div>
          )}

          {finding.cvssScore != null && (
            <p className="font-data text-xs text-muted">
              Skor tersimpan: {finding.cvssScore.toFixed(1)} — {finding.cvssVector}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bukti Berversi</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(isTester || isOwner) && (
            <form onSubmit={submitEvidence} className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="evidence-file">Tambah Versi Bukti</Label>
                <input
                  ref={fileInputRef}
                  id="evidence-file"
                  type="file"
                  className="block text-sm text-foreground"
                />
              </div>
              <Button type="submit" disabled={evidenceUploading}>{evidenceUploading ? "Mengunggah..." : "Unggah"}</Button>
            </form>
          )}
          {evidenceError && <p className="text-xs text-danger">{evidenceError}</p>}

          {finding.evidence.length === 0 ? (
            <EmptyState title="Belum ada bukti" description="Unggah tangkapan layar atau log sebagai versi pertama." />
          ) : (
            <ul className="flex flex-col gap-2">
              {(finding.evidence as EvidenceItem[]).map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2 text-sm">
                  <Badge variant="outline">v{ev.versionNo}</Badge>
                  <span className="font-data text-xs text-foreground">
                    {revealedId === ev.id ? ev.sha256 : `${ev.sha256.slice(0, 12)}...`}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-accent underline"
                    onClick={() => setRevealedId(revealedId === ev.id ? null : ev.id)}
                  >
                    {revealedId === ev.id ? "Sembunyikan" : "Lihat penuh"}
                  </button>
                  <button type="button" className="text-xs text-accent underline" onClick={() => copySha(ev.id, ev.sha256)}>
                    {copiedId === ev.id ? "Tersalin" : "Copy"}
                  </button>
                  <span className="text-xs text-muted">{ev.mimeType}</span>
                  <span className="font-data text-xs text-muted">{formatDateTime(ev.createdAt)} · {ev.uploader.name}</span>
                  <a
                    href={`/api/findings/${id}/evidence/${ev.id}/download`}
                    className="ml-auto text-xs text-accent underline"
                  >
                    Unduh
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tanggapan & Rencana Perbaikan (App Owner)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {finding.ownerResponse && (
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="text-xs font-medium text-muted">Tanggapan Terakhir</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{finding.ownerResponse}</p>
            </div>
          )}

          {isOwner && finding.status !== "selesai" ? (
            <form onSubmit={submitRespond} className="flex flex-col gap-3">
              <div>
                <Label htmlFor="ownerResponse">Tanggapan & Rencana Perbaikan</Label>
                <Textarea name="ownerResponse" id="ownerResponse" rows={4} required />
                <FieldError />
              </div>
              <div>
                <Label htmlFor="nextStatus">Ubah Status Menjadi</Label>
                <Select name="nextStatus" id="nextStatus" required defaultValue="dikerjakan">
                  <option value="dikerjakan">Dikerjakan</option>
                  <option value="menunggu_retest">Menunggu Uji Ulang</option>
                </Select>
              </div>
              {respondError && <p className="text-xs text-danger">{respondError}</p>}
              <div>
                <Button type="submit" disabled={respondSubmitting}>{respondSubmitting ? "Menyimpan..." : "Kirim Tanggapan"}</Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted">
              {finding.status === "selesai"
                ? "Temuan sudah selesai, tidak bisa ditanggapi lagi."
                : "Hanya App Owner aplikasi ini yang dapat mengisi tanggapan."}
            </p>
          )}
        </CardContent>
      </Card>

      {isTester && finding.status === "menunggu_retest" && (
        <Card>
          <CardHeader><CardTitle>Retest</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Jalankan uji ulang untuk memastikan temuan ini benar-benar tertutup. Sistem akan mencoba mengecek ulang otomatis
              (header/cookie/info disclosure); bila tidak bisa, isi hasil manual.
            </p>
            {retestError && <p className="text-xs text-danger">{retestError}</p>}
            {!retestNeedsManual ? (
              <div>
                <Button onClick={() => submitRetest({})} disabled={retestSubmitting}>
                  {retestSubmitting ? "Menjalankan retest..." : "Jalankan Retest"}
                </Button>
              </div>
            ) : (
              <form onSubmit={submitManualRetest} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="result">Hasil Manual</Label>
                  <Select name="result" id="result" required defaultValue="masih_terbuka">
                    <option value="tertutup">Tertutup</option>
                    <option value="masih_terbuka">Masih Terbuka</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="note">Catatan</Label>
                  <Textarea name="note" id="note" rows={2} />
                </div>
                <div>
                  <Button type="submit" disabled={retestSubmitting}>{retestSubmitting ? "Menyimpan..." : "Simpan Hasil Retest"}</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Riwayat Perpindahan Tahap</CardTitle></CardHeader>
        <CardContent>
          {finding.remediationEvents.length === 0 ? (
            <EmptyState title="Belum ada perpindahan tahap" />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(finding.remediationEvents as RemediationEventItem[]).map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
                  <span className="font-data text-xs text-muted">{formatDateTime(ev.createdAt)}</span>
                  <span className="text-foreground">
                    {STATUS_LABEL[ev.fromStatus ?? ""] ?? ev.fromStatus ?? "(awal)"} → {STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                  </span>
                  <span className="text-muted">oleh {ev.actor.name}</span>
                  {ev.note && <span className="text-xs text-muted">· {ev.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {finding.retests.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Riwayat Retest</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {(finding.retests as RetestItem[]).map((rt) => (
                <li key={rt.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
                  <span className="font-data text-xs text-muted">{formatDateTime(rt.createdAt)}</span>
                  <Badge variant={rt.result === "tertutup" ? "success" : "warning"}>{rt.result}</Badge>
                  <span className="text-muted">oleh {rt.verifier.name}</span>
                  {rt.note && <span className="text-xs text-muted">· {rt.note}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
