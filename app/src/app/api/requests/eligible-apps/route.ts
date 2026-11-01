import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";


// GET /api/requests/eligible-apps — aplikasi yang bisa dipilih Pentester saat
// mengajukan permintaan uji baru. Role kini global (bukan lagi penugasan
// per-aplikasi app_owner), jadi SEMUA aplikasi tersedia untuk SEMUA pentester.
export async function GET() {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  try {
    await requirePentester(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const apps = await prisma.application.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true, environment: true },
  });

  return NextResponse.json({ items: apps });
}
