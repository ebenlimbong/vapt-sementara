import { prisma } from "@/lib/db";
import { maskJson } from "@/lib/mask";
import type { Prisma } from "@prisma/client";

export type AuditInput = {
  actorId: string | null;
  action: string; // mis. "scan.rejected", "scope.approved", "finding.closed"
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * Tulis satu baris audit log — APPEND ONLY. Tidak ada fungsi update/delete
 * yang disediakan dengan sengaja; tabel audit_logs tidak punya endpoint ubah/hapus.
 * Metadata selalu disamarkan dulu (token/password) sebelum disimpan.
 */
export async function writeAudit(input: AuditInput) {
  const safeMetadata = input.metadata ? maskJson(input.metadata) : undefined;
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: (safeMetadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export function getClientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip");
}
