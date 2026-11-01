import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { handleApiError } from "@/lib/api-security";


const schema = z.object({ inScope: z.boolean() });

/** PATCH /api/api-security/endpoints/[id] — toggle in_scope per endpoint. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req.headers);
  try {
    const user = await requireCurrentUser();
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Field inScope wajib boolean." }, { status: 400 });
    }

    const endpoint = await prisma.apiEndpoint.findUnique({ where: { id } });
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint tidak ditemukan." }, { status: 404 });
    }

    await requirePentester(user, ip);

    const updated = await prisma.apiEndpoint.update({
      where: { id },
      data: { inScope: parsed.data.inScope },
    });

    await writeAudit({
      actorId: user.id,
      action: "apiendpoint.inscope_updated",
      entityType: "api_endpoint",
      entityId: id,
      metadata: { method: endpoint.method, path: endpoint.path, inScope: parsed.data.inScope },
      ipAddress: ip,
    });

    return NextResponse.json({ id: updated.id, inScope: updated.inScope });
  } catch (err) {
    return handleApiError(err);
  }
}
