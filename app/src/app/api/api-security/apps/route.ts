import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";

/**
 * Daftar SEMUA aplikasi kategori 'api' beserta ringkasan ApiSpec yang sudah diimpor.
 * Role global: admin & pentester sama-sama melihat seluruh aplikasi (tidak ada lagi
 * filter per-aplikasi lewat app_assignments). `role` pada respons dipakai UI untuk
 * menampilkan/menonaktifkan aksi (hanya pentester yang bisa mengimpor OpenAPI).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    await requireRole(user, VIEW_ROLES, {
      action: "apisecurity.apps_list_denied",
      ip: getClientIp(req.headers),
    });

    const apps = await prisma.application.findMany({
      where: { category: "api" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        environment: true,
        apiSpecs: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fileName: true,
            createdAt: true,
            _count: { select: { endpoints: true } },
          },
        },
      },
    });

    const items = apps.map((a) => ({
      id: a.id,
      name: a.name,
      baseUrl: a.baseUrl,
      environment: a.environment,
      specs: a.apiSpecs.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        createdAt: s.createdAt,
        endpointCount: s._count.endpoints,
      })),
    }));

    return NextResponse.json({ items, role: user.role });
  } catch (err) {
    return handleApiError(err);
  }
}
