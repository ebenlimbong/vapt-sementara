import { NextRequest, NextResponse } from "next/server";
import { load as yamlLoad } from "js-yaml";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, requirePentester } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { sha256Hex } from "@/lib/crypto";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";
import type { Prisma } from "@prisma/client";


const HTTP_METHODS = ["get", "post", "put", "delete", "patch"] as const;

type RejectedRef = { ref: string; reason: string };

/**
 * Jalan rekursif ke seluruh node dokumen OpenAPI: setiap `$ref` yang TIDAK diawali `#/`
 * (artinya menunjuk ke file/URL di luar dokumen ini) dicatat ke `rejected` dan node-nya
 * diganti placeholder — isi rujukan eksternal itu TIDAK PERNAH ikut disimpan sebagai params.
 * `$ref` internal (`#/...`) dibiarkan apa adanya (tidak diresolve, tapi tidak ditolak).
 */
function sanitizeRefs(node: unknown, rejected: Map<string, string>): unknown {
  if (Array.isArray(node)) {
    return node.map((n) => sanitizeRefs(n, rejected));
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.$ref === "string" && !obj.$ref.startsWith("#/")) {
      rejected.set(
        obj.$ref,
        "Rujukan ke luar dokumen ditolak (di luar cakupan impor)"
      );
      return { $rejectedRef: obj.$ref };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeRefs(v, rejected);
    }
    return out;
  }
  return node;
}

type ParsedEndpoint = {
  method: string;
  path: string;
  params: Prisma.InputJsonValue;
  inScope: boolean;
};

function buildEndpoints(sanitizedPaths: Record<string, unknown>): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];
  for (const [path, rawPathItem] of Object.entries(sanitizedPaths)) {
    if (!rawPathItem || typeof rawPathItem !== "object") continue;
    const pathItem = rawPathItem as Record<string, unknown>;
    const pathLevelParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== "object") continue;
      const operation = op as Record<string, unknown>;
      const opParams = Array.isArray(operation.parameters) ? operation.parameters : [];
      const params = {
        parameters: [...pathLevelParams, ...opParams],
        requestBody: operation.requestBody ?? null,
      } as Prisma.InputJsonValue;
      endpoints.push({
        method: method.toUpperCase(),
        path,
        params,
        inScope: true,
      });
    }
  }
  return endpoints;
}

/** GET /api/api-security/specs?appId=... — daftar ApiSpec yang sudah diimpor untuk sebuah aplikasi. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");
    if (!appId) {
      return NextResponse.json({ error: "appId wajib diisi." }, { status: 400 });
    }
    await requireRole(user, VIEW_ROLES, {
      action: "apispec.list_denied",
      ip: getClientIp(req.headers),
    });

    const specs = await prisma.apiSpec.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        checksum: true,
        createdAt: true,
        rejectedRefs: true,
        _count: { select: { endpoints: true } },
      },
    });

    return NextResponse.json({
      items: specs.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        checksum: s.checksum,
        createdAt: s.createdAt,
        endpointCount: s._count.endpoints,
        rejectedCount: Array.isArray(s.rejectedRefs) ? s.rejectedRefs.length : 0,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/api-security/specs — multipart form {appId, file}: impor OpenAPI 3.x. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const user = await requireCurrentUser();

    const form = await req.formData().catch(() => null);
    const appId = form?.get("appId");
    const file = form?.get("file");

    if (!form || typeof appId !== "string" || !appId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Berkas OpenAPI dan appId wajib diisi." },
        { status: 400 }
      );
    }

    const app = await prisma.application.findUnique({ where: { id: appId } });
    if (!app) {
      return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });
    }

    await requirePentester(user, ip);

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = buffer.toString("utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      try {
        parsed = yamlLoad(text);
      } catch {
        await writeAudit({
          actorId: user.id,
          action: "apispec.import_failed",
          entityType: "application",
          entityId: appId,
          metadata: { fileName: file.name, reason: "parse_error" },
          ipAddress: ip,
        });
        return NextResponse.json(
          { error: "Berkas bukan JSON atau YAML yang valid." },
          { status: 400 }
        );
      }
    }

    const doc = parsed as Record<string, unknown> | null;
    const openapiVersion = doc && typeof doc === "object" ? doc.openapi : undefined;
    const paths = doc && typeof doc === "object" ? doc.paths : undefined;
    const validVersion = typeof openapiVersion === "string" && openapiVersion.startsWith("3.");
    const validPaths = !!paths && typeof paths === "object" && !Array.isArray(paths);

    if (!doc || typeof doc !== "object" || !validVersion || !validPaths) {
      await writeAudit({
        actorId: user.id,
        action: "apispec.import_failed",
        entityType: "application",
        entityId: appId,
        metadata: {
          fileName: file.name,
          reason: !validVersion
            ? "openapi_version_unsupported"
            : "paths_missing_or_invalid",
        },
        ipAddress: ip,
      });
      return NextResponse.json(
        {
          error: !validVersion
            ? "Berkas tidak valid: field 'openapi' harus ada dan berawalan '3.' (OpenAPI 3.x)."
            : "Berkas tidak valid: field 'paths' wajib berupa object.",
        },
        { status: 400 }
      );
    }

    const rejectedMap = new Map<string, string>();
    const sanitizedDoc = sanitizeRefs(doc, rejectedMap) as Record<string, unknown>;
    const sanitizedPaths = sanitizedDoc.paths as Record<string, unknown>;
    const endpoints = buildEndpoints(sanitizedPaths);
    const rejectedRefs: RejectedRef[] = Array.from(rejectedMap, ([ref, reason]) => ({
      ref,
      reason,
    }));

    const checksum = sha256Hex(buffer);

    const spec = await prisma.$transaction(async (tx) => {
      const created = await tx.apiSpec.create({
        data: {
          appId,
          fileName: file.name,
          checksum,
          rejectedRefs: rejectedRefs as unknown as Prisma.InputJsonValue,
          importedBy: user.id,
        },
      });
      if (endpoints.length > 0) {
        await tx.apiEndpoint.createMany({
          data: endpoints.map((e) => ({
            specId: created.id,
            method: e.method,
            path: e.path,
            params: e.params,
            inScope: e.inScope,
          })),
        });
      }
      return created;
    });

    await writeAudit({
      actorId: user.id,
      action: "apispec.imported",
      entityType: "api_spec",
      entityId: spec.id,
      metadata: {
        fileName: file.name,
        endpointCount: endpoints.length,
        rejectedCount: rejectedRefs.length,
      },
      ipAddress: ip,
    });

    return NextResponse.json(
      {
        id: spec.id,
        fileName: spec.fileName,
        checksum: spec.checksum,
        createdAt: spec.createdAt,
        endpointCount: endpoints.length,
        rejectedCount: rejectedRefs.length,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
