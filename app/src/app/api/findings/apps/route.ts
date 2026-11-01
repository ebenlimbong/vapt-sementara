import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";


/**
 * Daftar seluruh aplikasi, dipakai untuk dropdown filter/pemilihan aplikasi di halaman
 * triage, findings, dan laporan. Peran sekarang GLOBAL (admin/pentester) — tidak ada lagi
 * penugasan per-aplikasi, jadi admin maupun pentester melihat SEMUA aplikasi yang sama.
 */
export async function GET(req: Request) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "finding.apps_list_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const apps = await prisma.application.findMany({
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items: apps.map((a) => ({ ...a, roles: [user.role] })) });
}
