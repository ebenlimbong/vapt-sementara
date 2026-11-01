import fs from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "@/lib/crypto";

export type StorageKind = "evidence" | "reports";

function baseDir(kind: StorageKind): string {
  const envDir = kind === "evidence" ? process.env.EVIDENCE_DIR : process.env.REPORTS_DIR;
  return path.resolve(process.cwd(), envDir ?? `./data/${kind}`);
}

/**
 * Simpan file ke volume evidence/reports dengan nama berbasis SHA-256 — immutable by design:
 * konten berbeda selalu jadi nama file (dan baris versi) baru, tidak pernah menimpa.
 * `relativePath` yang dikembalikan disimpan di kolom file_path (relatif terhadap base dir kind-nya).
 */
export async function saveImmutableFile(
  kind: StorageKind,
  subdir: string,
  buffer: Buffer,
  extension: string
): Promise<{ relativePath: string; sha256: string }> {
  const hash = sha256Hex(buffer);
  const dir = path.join(baseDir(kind), subdir);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${hash}${extension}`;
  const fullPath = path.join(dir, filename);
  try {
    await fs.access(fullPath);
  } catch {
    await fs.writeFile(fullPath, buffer);
  }
  return { relativePath: path.join(subdir, filename), sha256: hash };
}

export async function readStoredFile(kind: StorageKind, relativePath: string): Promise<Buffer> {
  return fs.readFile(path.join(baseDir(kind), relativePath));
}
