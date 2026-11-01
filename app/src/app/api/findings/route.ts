import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { recomputeAndPersistAppRating } from "@/lib/rating";
import { defaultDueDate } from "@/lib/finding-helpers";


export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "finding.list_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const severity = searchParams.get("severity") || "";
  const status = searchParams.get("status") || "";
  const appId = searchParams.get("appId") || "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  // Tidak ada lagi visibilitas per-aplikasi: admin & pentester melihat SEMUA temuan.
  const where: Record<string, unknown> = {};
  if (appId) where.appId = appId;
  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { app: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.finding.count({ where }),
    prisma.finding.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        app: { select: { id: true, name: true, category: true } },
      },
    }),
  ]);

  const items = rows.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    status: f.status,
    cvssScore: f.cvssScore,
    dueDate: f.dueDate,
    source: f.candidateId ? "scan" : "manual",
    app: f.app,
    createdAt: f.createdAt,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}

const createSchema = z.object({
  appId: z.string().min(1, "Aplikasi wajib dipilih."),
  title: z.string().min(1, "Judul wajib diisi."),
  description: z.string().min(1, "Deskripsi wajib diisi."),
  steps: z.string().min(1, "Langkah reproduksi wajib diisi."),
  impact: z.string().min(1, "Dampak wajib diisi."),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Semua kolom wajib diisi.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { appId, title, description, steps, impact, severity } = parsed.data;

  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const finding = await prisma.finding.create({
    data: {
      appId,
      title,
      description,
      steps,
      impact,
      severity,
      status: "baru",
      createdBy: user.id,
      dueDate: defaultDueDate(severity),
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "finding.created_manual",
    entityType: "finding",
    entityId: finding.id,
    metadata: { appId, severity },
    ipAddress: ip,
  });

  await recomputeAndPersistAppRating(appId);

  return NextResponse.json({ finding }, { status: 201 });
}
