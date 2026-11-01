import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


// GET /api/requests — daftar permintaan uji. Read-only: semua user yang login
// (admin & pentester) melihat semua permintaan — tidak ada lagi filter
// visibilitas per-aplikasi (role kini global, bukan penugasan per-aplikasi).
export async function GET(req: NextRequest) {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const appId = searchParams.get("appId") || "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const where: Record<string, unknown> = {};
  if (appId) where.appId = appId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { purpose: { contains: search, mode: "insensitive" } },
      { targetUrl: { contains: search, mode: "insensitive" } },
      { app: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.testRequest.count({ where }),
    prisma.testRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        app: { select: { id: true, name: true, category: true } },
        requester: { select: { id: true, name: true } },
        scopeVersions: { select: { id: true }, orderBy: { versionNo: "desc" }, take: 1 },
      },
    }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    purpose: r.purpose,
    targetUrl: r.targetUrl,
    status: r.status,
    desiredStart: r.desiredStart,
    desiredEnd: r.desiredEnd,
    createdAt: r.createdAt,
    app: r.app,
    requester: r.requester,
    hasScope: r.scopeVersions.length > 0,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}

const createSchema = z
  .object({
    appId: z.string().min(1, "Aplikasi wajib dipilih."),
    purpose: z.string().trim().min(1, "Tujuan pengujian wajib diisi."),
    targetUrl: z.string().trim().min(1, "Target URL wajib diisi."),
    desiredStart: z.coerce.date({ error: "Waktu mulai yang diinginkan wajib diisi." }),
    desiredEnd: z.coerce.date({ error: "Waktu selesai yang diinginkan wajib diisi." }),
  })
  .refine((v) => v.desiredEnd > v.desiredStart, {
    message: "Waktu selesai harus setelah waktu mulai.",
    path: ["desiredEnd"],
  });

// POST /api/requests — Pentester mengajukan permintaan uji baru (role global,
// bukan lagi penugasan per-aplikasi app_owner). Admin tidak bisa mengajukan
// lewat endpoint ini (pemisahan tugas: admin hanya menyetujui/mengelola).
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { appId, purpose, targetUrl, desiredStart, desiredEnd } = parsed.data;

  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });

  const created = await prisma.testRequest.create({
    data: { appId, requestedBy: user.id, purpose, targetUrl, desiredStart, desiredEnd },
  });

  await writeAudit({
    actorId: user.id,
    action: "request.created",
    entityType: "test_request",
    entityId: created.id,
    metadata: { appId, purpose, targetUrl, desiredStart, desiredEnd },
    ipAddress: ip,
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
