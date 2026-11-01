"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ROLES = ["admin", "coordinator", "tester", "app_owner"] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  coordinator: "Coordinator",
  tester: "Tester",
  app_owner: "App Owner",
};

type Assignment = { id: string; appId: string; role: string; app: { id: string; name: string } };
type UserDetail = {
  item: { id: string; name: string; email: string; status: string; mfaEnabled: boolean; createdAt: string };
  assignments: Assignment[];
};
type AppOption = { id: string; name: string };

export default function UserRolesPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const { data, error, isLoading, mutate } = useSWR<UserDetail & { error?: string }>(`/api/admin/users/${userId}`, fetcher);
  const { data: apps } = useSWR<{ items: AppOption[]; error?: string }>("/api/admin/applications", fetcher);

  if (isLoading) return <LoadingState rows={6} />;
  if (error || data?.error) {
    return <ErrorState description={data?.error ?? "Gagal memuat detail pengguna."} onRetry={() => mutate()} />;
  }
  if (!data) return null;

  const appList = apps?.items ?? [];
  const assignmentKey = (appId: string, role: string) => `${appId}:${role}`;
  const assignedSet = new Set(data.assignments.map((a) => assignmentKey(a.appId, a.role)));

  async function toggle(appId: string, role: string, checked: boolean) {
    const res = await fetch(`/api/admin/users/${userId}/assignments`, {
      method: checked ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, role }),
    });
    const json = await res.json();
    if (!res.ok) alert(json.error ?? "Gagal mengubah penugasan.");
    mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-xs text-muted hover:underline">&larr; Kembali ke daftar pengguna</Link>
        <h1 className="text-xl font-semibold text-foreground">{data.item.name}</h1>
        <p className="font-data text-sm text-muted">{data.item.email}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Info Akun</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted">Status</dt><dd><Badge variant={data.item.status === "active" ? "success" : "muted"}>{data.item.status === "active" ? "Aktif" : "Nonaktif"}</Badge></dd></div>
            <div><dt className="text-xs text-muted">MFA</dt><dd className="text-foreground">{data.item.mfaEnabled ? "Aktif" : "Belum aktif"}</dd></div>
            <div><dt className="text-xs text-muted">Dibuat</dt><dd className="font-data text-foreground">{formatDateTime(data.item.createdAt)}</dd></div>
            <div><dt className="text-xs text-muted">Total Penugasan</dt><dd className="text-foreground">{data.assignments.length}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Peran per Aplikasi</CardTitle></CardHeader>
        <CardContent>
          {appList.length === 0 ? (
            <EmptyState title="Belum ada aplikasi" description="Tambahkan aplikasi dulu di menu Aplikasi sebelum menugaskan peran." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted">
                    <th className="py-2 pr-4">Aplikasi</th>
                    {ROLES.map((r) => (
                      <th key={r} className="py-2 pr-4 text-center">{ROLE_LABEL[r]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appList.map((app) => (
                    <tr key={app.id} className="border-b border-border/60 hover:bg-surface-2">
                      <td className="py-2 pr-4 text-foreground">{app.name}</td>
                      {ROLES.map((role) => {
                        const key = assignmentKey(app.id, role);
                        const checked = assignedSet.has(key);
                        return (
                          <td key={role} className="py-2 pr-4 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-accent"
                              checked={checked}
                              onChange={(e) => toggle(app.id, role, e.target.checked)}
                              aria-label={`${ROLE_LABEL[role]} pada ${app.name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Tanpa centang apa pun pada satu baris, pengguna ini tidak punya akses sama sekali ke aplikasi tersebut (deny by default).</p>
        </CardContent>
      </Card>
    </div>
  );
}
