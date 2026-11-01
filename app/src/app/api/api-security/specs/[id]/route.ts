import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";


/** GET /api/api-security/specs/[id] — ringkasan impor: nama berkas, checksum, waktu, rejected_refs. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await ctx.params;

    const spec = await prisma.apiSpec.findUnique({
      where: { id },
      include: {
        app: { select: { id: true, name: true, baseUrl: true, category: true } },
        importer: { select: { id: true, name: true } },
        _count: { select: { endpoints: true } },
      },
    });
    if (!spec) {
      return NextResponse.json({ error: "Spesifikasi tidak ditemukan." }, { status: 404 });
    }

    await requireRole(user, VIEW_ROLES, {
      action: "apispec.view_denied",
      ip: getClientIp(req.headers),
    });

    return NextResponse.json({
      id: spec.id,
      fileName: spec.fileName,
      checksum: spec.checksum,
      checksumShort: spec.checksum.slice(0, 12),
      createdAt: spec.createdAt,
      app: spec.app,
      importer: spec.importer,
      endpointCount: spec._count.endpoints,
      rejectedRefs:
        (spec.rejectedRefs as unknown as { ref: string; reason: string }[] | null) ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
