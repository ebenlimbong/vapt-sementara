import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { canViewApp } from "@/lib/finding-helpers";


/** Daftar TestRequest milik satu aplikasi, untuk dropdown pembuatan laporan. */
export async function GET(req: NextRequest) {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || "";
  if (!appId) return NextResponse.json({ items: [] });

  const allowed = await canViewApp(user, appId);
  if (!allowed) return NextResponse.json({ items: [] });

  const items = await prisma.testRequest.findMany({
    where: { appId },
    orderBy: { createdAt: "desc" },
    select: { id: true, purpose: true, status: true, desiredStart: true, desiredEnd: true, createdAt: true },
  });

  return NextResponse.json({ items });
}
