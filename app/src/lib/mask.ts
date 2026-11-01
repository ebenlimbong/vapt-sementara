/**
 * Penyamaran data sensitif (token, password, cookie session, API key).
 * Dipakai di: audit log metadata, raw_payload kandidat, pratinjau & PDF laporan,
 * dan di mana pun data mentah hasil scan/log ditampilkan ke user.
 *
 * Prinsip: menyamarkan NILAI TAMPILAN, tidak pernah mengubah data asli di DB.
 */

const KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /mfa[_-]?secret/i,
  /private[_-]?key/i,
  /bearer/i,
  /x-api-key/i,
  /set-cookie/i,
];

// Pola nilai (bukan hanya nama key) yang terlihat seperti rahasia.
const VALUE_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, // JWT
  /\b[A-Za-z0-9+/]{32,}={0,2}\b/g, // base64 panjang / token acak
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key style
];

export const MASK_PLACEHOLDER = "[DISAMARKAN]";

function isSensitiveKey(key: string): boolean {
  return KEY_PATTERNS.some((p) => p.test(key));
}

/** Samarkan string bebas (body, log, raw payload sebagai teks). */
export function maskText(input: string): string {
  let out = input;
  for (const p of VALUE_PATTERNS) {
    out = out.replace(p, MASK_PLACEHOLDER);
  }
  return out;
}

/** Samarkan object/JSON secara rekursif berdasarkan nama field + nilai. */
export function maskJson<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return maskText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskJson(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = MASK_PLACEHOLDER;
      } else {
        out[k] = maskJson(v);
      }
    }
    return out as T;
  }
  return value;
}

/** Cek cepat: apakah teks mengandung pola yang seharusnya sudah tersamarkan? */
export function containsUnmaskedSecretPattern(input: string): boolean {
  return VALUE_PATTERNS.some((p) => p.test(input));
}

/** Tampilkan label kredensial tersamar penuh, mis. untuk UI vault. */
export function maskLabelValue(): string {
  return "••••••••";
}
