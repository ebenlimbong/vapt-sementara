import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { getAccessibleAppIds, isPlatformAdmin, hasRoleForApp } from "@/lib/rbac";


// GET /api/scope-approvals — antrean versi ruang lingkup FINAL yang belum
// diputuskan, lintas semua aplikasi yang dikoordinatori user (atau semua bila
// Admin platform). "Belum diputuskan" = isFinal true DAN belum punya baris
// ScopeApproval sama sekali.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || "";

  const admin = await isPlatformAdmin(user.id);
  let coordinatedAppIds: string[] | null = null;
  if (!admin) {
    const accessible = await getAccessibleAppIds(user.id);
    const checks = await Promise.all(accessible.map((id) => hasRoleForApp(user.id, id, ["coordinator"])));
    coordinatedAppIds = accessible.filter((_, i) => checks[i]);
    if (coordinatedAppIds.length === 0) {
      return NextResponse.json({ items: [] });
    }
  }

  if (!admin && appId && !coordinatedAppIds!.includes(appId)) {
    // Minta queue aplikasi yang bukan domain koordinasinya -> kosong, bukan leak.
    return NextResponse.json({ items: [] });
  }

  const where: Record<string, unknown> = {
    isFinal: true,
    approvals: { none: {} },
    request: appId ? { appId } : admin ? {} : { appId: { in: coordinatedAppIds! } },
  };

  const rows = await prisma.scopeVersion.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      creator: { select: { id: true, name: true } },
      request: {
        select: {
          id: true,
          purpose: true,
          targetUrl: true,
          app: { select: { id: true, name: true } },
        },
      },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    versionNo: r.versionNo,
    createdAt: r.createdAt,
    hasDiff: r.diffSummary !== null,
    creator: r.creator,
    request: r.request,
  }));

  return NextResponse.json({ items });
}
