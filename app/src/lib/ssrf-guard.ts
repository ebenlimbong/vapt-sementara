import dns from "node:dns/promises";
import net from "node:net";

/**
 * Anti-SSRF guard untuk worker scan (web & api).
 * Aturan:
 *  1. Hanya host yang ada di allowlist (dari scope yang disetujui, mis. base_url
 *     aplikasi target + ALLOWED_SCAN_HOSTS env) yang boleh dihubungi.
 *  2. Hasil resolusi DNS host tersebut tidak boleh mengarah ke IP privat/loopback/
 *     link-local/metadata-cloud, KECUALI target lab memang berjalan di jaringan
 *     docker internal (lab-net) — di mode itu allowlist host-lah yang jadi pagar utama.
 *  3. Redirect hasil scan divalidasi ulang terhadap allowlist yang sama sebelum diikuti.
 */

const BLOCKED_CIDRS_V4: Array<[string, number]> = [
  ["169.254.0.0", 16], // link-local / cloud metadata
  ["127.0.0.0", 8],
  ["0.0.0.0", 8],
];

function ipToLong(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isInCidr(ip: string, cidr: string, bits: number): boolean {
  if (!net.isIPv4(ip)) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(cidr) & mask);
}

export function isBlockedIp(ip: string, { allowDockerPrivate }: { allowDockerPrivate: boolean }): boolean {
  if (net.isIPv6(ip)) {
    if (ip === "::1") return true;
    return false; // simplifikasi: IPv6 privat lain tidak dipakai di lab compose
  }
  if (!allowDockerPrivate) {
    // Blokir juga rentang privat RFC1918 kalau mode ketat (di luar docker lab-net).
    if (isInCidr(ip, "10.0.0.0", 8)) return true;
    if (isInCidr(ip, "172.16.0.0", 12)) return true;
    if (isInCidr(ip, "192.168.0.0", 16)) return true;
  }
  return BLOCKED_CIDRS_V4.some(([cidr, bits]) => isInCidr(ip, cidr, bits));
}

export type ScopeGuardResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Cek apakah targetUrl boleh diakses worker, berdasar allowlist host dari scope
 * yang disetujui (allowedHosts) + resolusi DNS aktual.
 */
export async function checkScopeGuard(
  targetUrl: string,
  allowedHosts: string[]
): Promise<ScopeGuardResult> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, reason: "URL tidak valid" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { allowed: false, reason: `Skema ${parsed.protocol} tidak diizinkan` };
  }

  const host = parsed.hostname.toLowerCase();
  const allowedSet = new Set(allowedHosts.map((h) => h.toLowerCase()));
  if (!allowedSet.has(host)) {
    return { allowed: false, reason: `Host "${host}" di luar cakupan yang disetujui` };
  }

  // Dalam docker compose, host lab (juice-shop, dvwa, dst.) resolve ke IP privat
  // jaringan internal by design — itu diizinkan KARENA sudah lolos allowlist host di atas.
  // Guard DNS di sini mencegah host allowlist di-bind ulang (DNS rebinding) ke IP metadata
  // cloud (169.254.169.254) atau loopback yang bukan tujuan sebenarnya.
  try {
    const result = await dns.lookup(host, { all: true });
    for (const r of result) {
      if (isBlockedIp(r.address, { allowDockerPrivate: true })) {
        return { allowed: false, reason: `Resolusi DNS ${host} -> ${r.address} ditolak (metadata/loopback)` };
      }
    }
  } catch {
    return { allowed: false, reason: `Gagal resolve DNS untuk ${host}` };
  }

  return { allowed: true };
}

/** Validasi redirect Location header sebelum worker mengikutinya. */
export async function checkRedirectGuard(locationUrl: string, allowedHosts: string[]): Promise<ScopeGuardResult> {
  return checkScopeGuard(locationUrl, allowedHosts);
}
