"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Input, Select, Label, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SpecDetail = {
  id: string;
  fileName: string;
  checksum: string;
  checksumShort: string;
  createdAt: string;
  app: { id: string; name: string; baseUrl: string; category: string };
  importer: { id: string; name: string };
  endpointCount: number;
  rejectedRefs: { ref: string; reason: string }[];
};

type TabKey = "ringkasan" | "endpoint" | "akun" | "skenario";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ringkasan", label: "Ringkasan Impor" },
  { key: "endpoint", label: "Inventaris Endpoint" },
  { key: "akun", label: "Akun Uji" },
  { key: "skenario", label: "Skenario Ekspektasi Akses" },
];

export default function ApiSpecDetailPage() {
  const params = useParams<{ specId: string }>();
  const specId = params.specId;
  const [tab, setTab] = useState<TabKey>("ringkasan");

  const { data: spec, error, isLoading, mutate } = useSWR<SpecDetail>(
    specId ? `/api/api-security/specs/${specId}` : null,
    fetcher
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {isLoading ? "Memuat..." : error ? "Spesifikasi" : spec?.fileName}
        </h1>
        <p className="text-sm text-muted">
          {isLoading ? "" : error ? "" : `${spec?.app.name} · ${spec?.app.baseUrl}`}
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error || !spec ? (
        <ErrorState
          description="Gagal memuat spesifikasi ini. Mungkin tidak ditemukan atau Anda tidak punya akses."
          onRetry={() => mutate()}
        />
      ) : (
        <>
          {tab === "ringkasan" && <RingkasanTab spec={spec} />}
          {tab === "endpoint" && <EndpointTab specId={spec.id} />}
          {tab === "akun" && <AkunUjiTab appId={spec.app.id} />}
          {tab === "skenario" && <SkenarioTab specId={spec.id} appId={spec.app.id} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ringkasan Impor
// ---------------------------------------------------------------------------
function RingkasanTab({ spec }: { spec: SpecDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Impor</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-muted">Nama Berkas</dt>
              <dd className="font-data text-foreground">{spec.fileName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">Waktu Impor</dt>
              <dd className="font-data text-foreground">{formatDateTime(spec.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">Checksum (SHA-256, singkat)</dt>
              <dd className="font-data text-foreground">{spec.checksumShort}…</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">Jumlah Endpoint</dt>
              <dd className="font-data text-foreground">{spec.endpointCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted">Diimpor Oleh</dt>
              <dd className="text-foreground">{spec.importer.name}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rujukan ($ref) Ditolak</CardTitle>
        </CardHeader>
        <CardContent>
          {spec.rejectedRefs.length === 0 ? (
            <EmptyState
              title="Tidak ada rujukan eksternal ditolak"
              description="Semua $ref pada berkas ini mengarah ke dalam dokumen (#/...)."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Rujukan</th>
                    <th className="py-2 pr-4">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {spec.rejectedRefs.map((r, i) => (
                    <tr key={`${r.ref}-${i}`} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-data text-danger">{r.ref}</td>
                      <td className="py-2 pr-4 text-muted">{r.reason}</td>
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

// ---------------------------------------------------------------------------
// Inventaris Endpoint
// ---------------------------------------------------------------------------
type EndpointItem = {
  id: string;
  method: string;
  path: string;
  params: unknown;
  inScope: boolean;
};

function EndpointTab({ specId }: { specId: string }) {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");
  const [inScope, setInScope] = useState("");

  const query = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(method ? { method } : {}),
    ...(inScope ? { inScope } : {}),
  }).toString();

  const { data, error, isLoading, mutate } = useSWR<{ items: EndpointItem[] }>(
    `/api/api-security/specs/${specId}/endpoints?${query}`,
    fetcher
  );

  async function toggleInScope(ep: EndpointItem) {
    await fetch(`/api/api-security/endpoints/${ep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inScope: !ep.inScope }),
    });
    mutate();
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
        <CardTitle>Inventaris Endpoint</CardTitle>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Input
            placeholder="Cari path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-48"
          />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-32">
            <option value="">Semua method</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </Select>
          <Select value={inScope} onChange={(e) => setInScope(e.target.value)} className="w-36">
            <option value="">Semua cakupan</option>
            <option value="true">Dalam cakupan</option>
            <option value="false">Luar cakupan</option>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState rows={5} />
        ) : error ? (
          <ErrorState description="Gagal memuat endpoint." onRetry={() => mutate()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Belum ada endpoint"
            description="Impor OpenAPI dulu dari halaman daftar Uji Akses API."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted">
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Path</th>
                  <th className="py-2 pr-4">Params</th>
                  <th className="py-2 pr-4">Dalam Cakupan</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ep) => {
                  const paramsObj = ep.params as {
                    parameters?: unknown[];
                    requestBody?: unknown;
                  } | null;
                  const paramCount = paramsObj?.parameters?.length ?? 0;
                  const hasBody = !!paramsObj?.requestBody;
                  return (
                    <tr key={ep.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="font-data">
                          {ep.method}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-data text-foreground">{ep.path}</td>
                      <td className="py-2 pr-4 text-xs text-muted">
                        {paramCount} param{hasBody ? " + body" : ""}
                      </td>
                      <td className="py-2 pr-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ep.inScope}
                            onChange={() => toggleInScope(ep)}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          <Badge variant={ep.inScope ? "success" : "muted"}>
                            {ep.inScope ? "ya" : "tidak"}
                          </Badge>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Akun Uji per Role
// ---------------------------------------------------------------------------
type TestAccountItem = { id: string; roleLabel: string; createdAt: string; maskedValue: string };

function AkunUjiTab({ appId }: { appId: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ items: TestAccountItem[] }>(
    `/api/api-security/test-accounts?appId=${appId}`,
    fetcher
  );
  const [roleLabel, setRoleLabel] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roleLabel.trim() || !secretValue) {
      setFormError("Label peran dan nilai kredensial wajib diisi.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/api-security/test-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, roleLabel, secretValue }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error ?? "Gagal menambah akun uji.");
        return;
      }
      setRoleLabel("");
      setSecretValue("");
      mutate();
    } catch {
      setFormError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/api-security/test-accounts/${id}`, { method: "DELETE" });
    if (res.ok) mutate();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Tambah Akun Uji</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="role-label">Label Peran</Label>
              <Input
                id="role-label"
                placeholder="mis. admin, user_biasa, tanpa_login"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="secret-value">Nilai Kredensial (password/token)</Label>
              <Input
                id="secret-value"
                type="password"
                placeholder="disimpan terenkripsi di vault"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Tambah"}
            </Button>
          </form>
          <FieldError>{formError}</FieldError>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Akun Uji</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={3} />
          ) : error ? (
            <ErrorState description="Gagal memuat akun uji." onRetry={() => mutate()} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="Belum ada akun uji"
              description="Tambah akun uji per role untuk membandingkan perilaku akses."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {data.items.map((acc) => (
                <li
                  key={acc.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{acc.roleLabel}</p>
                    <p className="font-data text-xs text-muted">{acc.maskedValue}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">{formatDateTime(acc.createdAt)}</span>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(acc.id)}>
                      Hapus
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skenario Ekspektasi Akses + Jalankan Pengujian
// ---------------------------------------------------------------------------
type ScenarioItem = {
  id: string;
  actorRole: string;
  expected: "allow" | "deny";
  actual: string | null;
  verdict: "sesuai" | "menyimpang" | null;
  jobId: string | null;
  endpoint: { id: string; method: string; path: string };
  actorAccount: { id: string; roleLabel: string } | null;
};

function SkenarioTab({ specId, appId }: { specId: string; appId: string }) {
  const { data: scenarios, error, isLoading, mutate } = useSWR<{ items: ScenarioItem[] }>(
    `/api/api-security/scenarios?specId=${specId}`,
    fetcher,
    { refreshInterval: 3000 }
  );
  const { data: endpoints } = useSWR<{ items: EndpointItem[] }>(
    `/api/api-security/specs/${specId}/endpoints?inScope=true`,
    fetcher
  );
  const { data: accounts } = useSWR<{ items: TestAccountItem[] }>(
    `/api/api-security/test-accounts?appId=${appId}`,
    fetcher
  );

  const [endpointId, setEndpointId] = useState("");
  const [actorAccountId, setActorAccountId] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [expected, setExpected] = useState<"allow" | "deny">("deny");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAddScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!endpointId || !actorRole.trim()) {
      setFormError("Endpoint dan peran wajib diisi.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/api-security/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpointId,
          actorAccountId: actorAccountId || null,
          actorRole,
          expected,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error ?? "Gagal menambah skenario.");
        return;
      }
      setEndpointId("");
      setActorAccountId("");
      setActorRole("");
      setExpected("deny");
      mutate();
    } catch {
      setFormError("Gagal terhubung ke server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Tambah Skenario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddScenario} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <Label htmlFor="scn-endpoint">Endpoint</Label>
              <Select
                id="scn-endpoint"
                value={endpointId}
                onChange={(e) => setEndpointId(e.target.value)}
              >
                <option value="">Pilih endpoint...</option>
                {endpoints?.items.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.method} {ep.path}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="scn-account">Akun Uji</Label>
              <Select
                id="scn-account"
                value={actorAccountId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActorAccountId(val);
                  const acc = accounts?.items.find((a) => a.id === val);
                  if (acc) setActorRole(acc.roleLabel);
                }}
              >
                <option value="">Tanpa akun (anonim)</option>
                {accounts?.items.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.roleLabel}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label htmlFor="scn-role">Label Peran Penguji</Label>
              <Input
                id="scn-role"
                placeholder="mis. tidak_terautentikasi"
                value={actorRole}
                onChange={(e) => setActorRole(e.target.value)}
              />
            </div>
            <div className="w-32">
              <Label htmlFor="scn-expected">Ekspektasi</Label>
              <Select
                id="scn-expected"
                value={expected}
                onChange={(e) => setExpected(e.target.value as "allow" | "deny")}
              >
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </Select>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Tambah Skenario"}
            </Button>
          </form>
          <FieldError>{formError}</FieldError>
        </CardContent>
      </Card>

      <RunTestingCard appId={appId} specId={specId} onRun={() => mutate()} />

      <Card>
        <CardHeader>
          <CardTitle>Daftar Skenario</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={4} />
          ) : error ? (
            <ErrorState description="Gagal memuat skenario." onRetry={() => mutate()} />
          ) : !scenarios || scenarios.items.length === 0 ? (
            <EmptyState
              title="Belum ada skenario"
              description="Tambah skenario per endpoint: siapa boleh akses apa."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Endpoint</th>
                    <th className="py-2 pr-4">Peran</th>
                    <th className="py-2 pr-4">Akun</th>
                    <th className="py-2 pr-4">Expected</th>
                    <th className="py-2 pr-4">Actual</th>
                    <th className="py-2 pr-4">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.items.map((s) => (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-data text-foreground">
                        {s.endpoint.method} {s.endpoint.path}
                      </td>
                      <td className="py-2 pr-4 text-foreground">{s.actorRole}</td>
                      <td className="py-2 pr-4 text-muted">{s.actorAccount?.roleLabel ?? "-"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.expected === "allow" ? "success" : "danger"}>
                          {s.expected}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-data text-xs text-muted">{s.actual ?? "-"}</td>
                      <td className="py-2 pr-4">
                        {s.verdict ? (
                          <Badge variant={s.verdict === "sesuai" ? "success" : "danger"}>
                            {s.verdict}
                          </Badge>
                        ) : (
                          <Badge variant="muted">{s.jobId ? "menunggu hasil" : "belum diuji"}</Badge>
                        )}
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

type RequestItem = {
  id: string;
  purpose: string;
  targetUrl: string;
  status: string;
  createdAt: string;
};

function RunTestingCard({
  appId,
  specId,
  onRun,
}: {
  appId: string;
  specId: string;
  onRun: () => void;
}) {
  const { data: requests, isLoading: requestsLoading } = useSWR<{ items: RequestItem[] }>(
    `/api/api-security/requests?appId=${appId}`,
    fetcher
  );
  const [requestId, setRequestId] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const { data: permission } = useSWR<
    { allowed: true; windowStart: string; windowEnd: string } | { allowed: false; reason: string }
  >(requestId ? `/api/api-security/run?requestId=${requestId}` : null, fetcher, {
    refreshInterval: 5000,
  });

  async function handleRun() {
    if (!requestId) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/api-security/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, specId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRunError(body.error ?? "Gagal menjalankan pengujian.");
        return;
      }
      onRun();
    } catch {
      setRunError("Gagal terhubung ke server.");
    } finally {
      setRunning(false);
    }
  }

  const notAllowedReason = permission && !permission.allowed ? permission.reason : null;
  const disabled = !requestId || !permission || !permission.allowed || running;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jalankan Pengujian</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="run-request">Permintaan Tes (scope yang disetujui)</Label>
            <Select
              id="run-request"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              disabled={requestsLoading}
            >
              <option value="">Pilih permintaan tes...</option>
              {requests?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.purpose} ({r.status})
                </option>
              ))}
            </Select>
          </div>
          <Button
            onClick={handleRun}
            disabled={disabled}
            title={notAllowedReason ?? undefined}
          >
            {running ? "Menjalankan..." : "Jalankan Pengujian"}
          </Button>
        </div>
        {!requestsLoading && requests?.items.length === 0 && (
          <p className="mt-2 text-xs text-muted">
            Belum ada permintaan tes untuk aplikasi ini. Ajukan dulu dari menu Permintaan Tes.
          </p>
        )}
        {notAllowedReason && (
          <p className="mt-2 text-xs text-danger">{notAllowedReason}</p>
        )}
        <FieldError>{runError}</FieldError>
      </CardContent>
    </Card>
  );
}
