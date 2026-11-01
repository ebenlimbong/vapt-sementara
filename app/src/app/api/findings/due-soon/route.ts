import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";


export async function GET(req: Request) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "finding.due_soon_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);

  // Tidak ada lagi visibilitas per-aplikasi: admin & pentester melihat SEMUA temuan due-soon.
  const where: Record<string, unknown> = {
    dueDate: { lte: threshold },
    status: { not: "selesai" },
  };

  const items = await prisma.finding.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { app: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ items });
}
