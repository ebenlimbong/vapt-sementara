import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, requirePentester } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";


const createSchema = z.object({
  endpointId: z.string().uuid(),
  actorAccountId: z.string().uuid().nullable().optional(),
  actorRole: z.string().trim().min(1).max(100),
  expected: z.enum(["allow", "deny"]),
});

/** GET /api/api-security/scenarios?specId=... — skenario + actual/verdict (hasil worker). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const specId = searchParams.get("specId");
    if (!specId) {
      return NextResponse.json({ error: "specId wajib diisi." }, { status: 400 });
    }

    const spec = await prisma.apiSpec.findUnique({ where: { id: specId }, select: { appId: true } });
    if (!spec) {
      return NextResponse.json({ error: "Spesifikasi tidak ditemukan." }, { status: 404 });
    }
    await requireAppRole(user, spec.appId, VIEW_ROLES, {
      action: "accessscenario.list_denied",
      ip: getClientIp(req.headers),
    });

    const scenarios = await prisma.accessScenario.findMany({
      where: { endpoint: { specId } },
      orderBy: { createdAt: "desc" },
      include: {
        endpoint: { select: { id: true, method: true, path: true } },
        // Hanya roleLabel — credentialRef/nilai vault TIDAK pernah di-join ke sini.
        actorAccount: { select: { id: true, roleLabel: true } },
      },
    });

    return NextResponse.json({ items: scenarios });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/api-security/scenarios — buat skenario ekspektasi akses per endpoint. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const user = await requireCurrentUser();
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "endpointId, actorRole, dan expected (allow/deny) wajib diisi." },
        { status: 400 }
      );
    }
    const { endpointId, actorAccountId, actorRole, expected } = parsed.data;

    const endpoint = await prisma.apiEndpoint.findUnique({
      where: { id: endpointId },
      select: { id: true, method: true, path: true, spec: { select: { appId: true } } },
    });
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint tidak ditemukan." }, { status: 404 });
    }

    await requireAppRole(user, endpoint.spec.appId, TESTER_ONLY, {
      action: "accessscenario.create_denied",
      ip,
    });

    if (actorAccountId) {
      const account = await prisma.testAccount.findUnique({
        where: { id: actorAccountId },
        select: { appId: true },
      });
      if (!account || account.appId !== endpoint.spec.appId) {
        return NextResponse.json(
          { error: "Akun uji tidak valid untuk aplikasi ini." },
          { status: 400 }
        );
      }
    }

    const scenario = await prisma.accessScenario.create({
      data: {
        endpointId,
        actorAccountId: actorAccountId ?? null,
        actorRole,
        expected,
      },
      include: {
        endpoint: { select: { id: true, method: true, path: true } },
        actorAccount: { select: { id: true, roleLabel: true } },
      },
    });

    await writeAudit({
      actorId: user.id,
      action: "accessscenario.created",
      entityType: "access_scenario",
      entityId: scenario.id,
      metadata: {
        endpointId,
        method: endpoint.method,
        path: endpoint.path,
        actorRole,
        expected,
      },
      ipAddress: ip,
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
