"use client";

import useSWR from "swr";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Select, Textarea, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low", "info"] as const;

type CandidateListItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  app: { id: string; name: string; category: string };
  job: { id: string; jobType: string };
};

type CandidateDetail = {
  id: string;
  title: string;
  category: string;
  normalizedKey: string;
  status: string;
  createdAt: string;
  rawPayload: unknown;
  app: { id: string; name: string; category: string };
  endpoint: { id: string; method: string; path: string } | null;
};

export default function TriagePage() {
  const [appId, setAppId] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"verify" | "dismiss" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: appsData } = useSWR("/api/findings/apps", fetcher);
  const apps: { id: string; name: string }[] = appsData?.items ?? [];

  const query = new URLSearchParams({ status: "baru", ...(appId ? { appId } : {}), ...(category ? { category } : {}) }).toString();
  const { data, error, isLoading, mutate } = useSWR(`/api/triage/candidates?${query}`, fetcher, { refreshInterval: 8000 });

  const { data: detailData, isLoading: detailLoading } = useSWR<{ candidate: never } | CandidateDetail>(
    selectedId ? `/api/triage/candidates/${selectedId}` : null,
    fetcher
  );
  const detail = detailData as CandidateDetail | undefined;

  function openCandidate(id: string) {
    setSelectedId(id);
    setMode(null);
    setSubmitError(null);
  }

  function closeDialog() {
    setSelectedId(null);
    setMode(null);
    setSubmitError(null);
  }

  async function submitVerify(formEl: HTMLFormElement) {
    if (!selectedId) return;
    const fd = new FormData(formEl);
    const payload = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      steps: String(fd.get("steps") ?? ""),
      impact: String(fd.get("impact") ?? ""),
      severity: String(fd.get("severity") ?? ""),
    };
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/triage/candidates/${selectedId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(json.error ?? "Gagal menjadikan temuan.");
      return;
    }
    await mutate();
    closeDialog();
  }

  async function submitDismiss(formEl: HTMLFormElement) {
    if (!selectedId) return;
    const fd = new FormData(formEl);
    const reason = String(fd.get("reason") ?? "");
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/triage/candidates/${selectedId}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(json.error ?? "Gagal menandai alarm palsu.");
      return;
    }
    await mutate();
    closeDialog();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Triage Kandidat</h1>
        <p className="text-sm text-muted">Antrean kandidat hasil scan yang belum diverifikasi. Pilih kandidat untuk menjadikannya temuan resmi atau menandainya alarm palsu.</p>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CardTitle>Antrean Kandidat (baru)</CardTitle>
          <div className="flex w-full gap-2 sm:w-auto">
            <Select value={appId} onChange={(e) => setAppId(e.target.value)} className="w-48">
              <option value="">Semua aplikasi</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
              <option value="">Semua kategori</option>
              <option value="header">header</option>
              <option value="cookie">cookie</option>
              <option value="info_disclosure">info_disclosure</option>
              <option value="akses_api">akses_api</option>
              <option value="tech_fingerprint">tech_fingerprint (httpx)</option>
              <option value="cve">cve (nuclei)</option>
              <option value="exposure">exposure (nuclei)</option>
              <option value="misconfig">misconfig (nuclei)</option>
            </Select>
            {(appId || category) && (
              <Button variant="outline" size="sm" onClick={() => { setAppId(""); setCategory(""); }}>Reset</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={5} />
          ) : error ? (
            <ErrorState description="Gagal memuat antrean kandidat." onRetry={() => mutate()} />
          ) : data.items.length === 0 ? (
            <EmptyState
              title="Antrean kosong"
              description="Tidak ada kandidat baru yang menunggu triase untuk filter ini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Judul</th>
                    <th className="py-2 pr-4">Kategori</th>
                    <th className="py-2 pr-4">Aplikasi</th>
                    <th className="py-2 pr-4">Job</th>
                    <th className="py-2 pr-4">Ditemukan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c: CandidateListItem) => (
                    <tr
                      key={c.id}
                      onClick={() => openCandidate(c.id)}
                      className="cursor-pointer border-b border-border/60 hover:bg-surface-2"
                    >
                      <td className="py-2 pr-4 text-foreground">{c.title}</td>
                      <td className="py-2 pr-4"><Badge>{c.category}</Badge></td>
                      <td className="py-2 pr-4 text-foreground">{c.app.name}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{c.job.jobType}</td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{formatDateTime(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl">
          {detailLoading || !detail ? (
            <LoadingState rows={4} />
          ) : (
            <>
              <DialogTitle>{detail.title}</DialogTitle>
              <DialogDescription>
                {detail.app.name} · <Badge>{detail.category}</Badge>
                {detail.endpoint && <span className="ml-2 font-data">{detail.endpoint.method} {detail.endpoint.path}</span>}
              </DialogDescription>

              <div className="mt-3 max-h-56 overflow-auto rounded-md border border-border bg-surface-2 p-3">
                <pre className="font-data text-xs whitespace-pre-wrap break-all text-foreground">
                  {JSON.stringify(detail.rawPayload, null, 2)}
                </pre>
              </div>

              {submitError && <p className="mt-2 text-xs text-danger">{submitError}</p>}

              {mode === null && (
                <DialogFooter>
                  <Button variant="danger" onClick={() => setMode("dismiss")}>Tandai Alarm Palsu</Button>
                  <Button onClick={() => setMode("verify")}>Jadikan Temuan</Button>
                </DialogFooter>
              )}

              {mode === "verify" && (() => {
                const rp = (detail.rawPayload ?? {}) as { severity?: string; tool?: string; cveId?: string };
                const suggestedSeverity = SEVERITY_OPTIONS.includes(rp.severity as typeof SEVERITY_OPTIONS[number])
                  ? (rp.severity as typeof SEVERITY_OPTIONS[number])
                  : "medium";
                return (
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={(e) => { e.preventDefault(); submitVerify(e.currentTarget); }}
                >
                  <div>
                    <Label htmlFor="title">Judul Temuan</Label>
                    <input name="title" id="title" defaultValue={detail.title} required
                      className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/50" />
                  </div>
                  <div>
                    <Label htmlFor="severity">Severity Awal</Label>
                    <Select name="severity" id="severity" defaultValue={suggestedSeverity} required>
                      {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    {rp.severity && (
                      <p className="mt-1 text-xs text-muted">
                        Disarankan dari hasil tool ({rp.tool ?? "scan"}): <span className="font-data">{rp.severity}</span>
                        {rp.cveId && <> · <span className="font-data">{rp.cveId}</span></>}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="description">Deskripsi</Label>
                    <Textarea name="description" id="description" rows={3} required />
                  </div>
                  <div>
                    <Label htmlFor="steps">Langkah Reproduksi</Label>
                    <Textarea name="steps" id="steps" rows={3} required />
                  </div>
                  <div>
                    <Label htmlFor="impact">Dampak</Label>
                    <Textarea name="impact" id="impact" rows={2} required />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMode(null)}>Batal</Button>
                    <Button type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Temuan"}</Button>
                  </DialogFooter>
                </form>
                );
              })()}

              {mode === "dismiss" && (
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={(e) => { e.preventDefault(); submitDismiss(e.currentTarget); }}
                >
                  <div>
                    <Label htmlFor="reason">Alasan Alarm Palsu</Label>
                    <Textarea name="reason" id="reason" rows={3} required />
                    <FieldError />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setMode(null)}>Batal</Button>
                    <Button type="submit" variant="danger" disabled={submitting}>{submitting ? "Menyimpan..." : "Tandai Alarm Palsu"}</Button>
                  </DialogFooter>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
