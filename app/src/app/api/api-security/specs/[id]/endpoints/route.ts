import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";
import type { Prisma } from "@prisma/client";


/** GET /api/api-security/specs/[id]/endpoints — inventaris endpoint + search/filter. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id: specId } = await ctx.params;

    const spec = await prisma.apiSpec.findUnique({
      where: { id: specId },
      select: { appId: true },
    });
    if (!spec) {
      return NextResponse.json({ error: "Spesifikasi tidak ditemukan." }, { status: 404 });
    }
    await requireRole(user, VIEW_ROLES, {
      action: "apiendpoint.list_denied",
      ip: getClientIp(req.headers),
    });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const method = searchParams.get("method")?.trim() || "";
    const inScopeParam = searchParams.get("inScope");

    const where: Prisma.ApiEndpointWhereInput = { specId };
    if (method) where.method = method.toUpperCase();
    if (inScopeParam === "true") where.inScope = true;
    if (inScopeParam === "false") where.inScope = false;
    if (search) where.path = { contains: search, mode: "insensitive" };

    const endpoints = await prisma.apiEndpoint.findMany({
      where,
      orderBy: [{ path: "asc" }, { method: "asc" }],
    });

    return NextResponse.json({ items: endpoints });
  } catch (err) {
    return handleApiError(err);
  }
}
