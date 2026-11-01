import crypto from "node:crypto";

/**
 * Vault kredensial: AES-256-GCM dengan kunci dari env VAULT_KEY.
 * Nilai terenkripsi disimpan sebagai base64("v1." + iv + tag + ciphertext).
 * Nilai asli HANYA didekripsi di memori worker saat scan berjalan — tidak
 * pernah dikembalikan oleh API ke UI (lihat src/lib/mask.ts untuk tampilan).
 */

function getKey(): Buffer {
  const raw = process.env.VAULT_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      "VAULT_KEY belum diset atau terlalu pendek (min 16 karakter). Set di .env"
    );
  }
  // Derive 32-byte key dari secret apapun panjangnya via SHA-256.
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]);
  return "v1." + payload.toString("base64");
}

export function decryptSecret(encoded: string): string {
  if (!encoded.startsWith("v1.")) {
    throw new Error("Format vault tidak dikenali");
  }
  const key = getKey();
  const payload = Buffer.from(encoded.slice(3), "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
