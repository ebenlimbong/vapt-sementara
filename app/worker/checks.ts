/**
 * Pemeriksaan web dasar sesuai cakupan Fase 2 PRD: header, cookie, info disclosure.
 * Referensi longgar: OWASP WSTG v4.2 (WSTG-CONF, WSTG-INFO).
 */

export type RawCheckFinding = {
  title: string;
  category: "header" | "cookie" | "info_disclosure" | "tech_fingerprint" | "cve" | "exposure" | "misconfig";
  normalizedKey: string;
  rawPayload: Record<string, unknown>;
};

const VERSION_BANNER_RE = /\b(Apache|nginx|Microsoft-IIS|PHP|Express|OpenSSL)\/[0-9][0-9.]*\b/i;

const INFO_DISCLOSURE_BODY_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "stack_trace_java", re: /at\s+[\w.$]+\([\w.]+\.java:\d+\)/ },
  { name: "stack_trace_python", re: /Traceback \(most recent call last\)/ },
  { name: "php_warning_notice", re: /\b(Warning|Notice|Fatal error):.*on line \d+/ },
  { name: "directory_listing", re: /Index of \/[^\n<]*/ },
  { name: "spring_whitelabel", re: /Whitelabel Error Page/ },
  { name: "sql_error_leak", re: /(SQLSTATE\[|You have an error in your SQL syntax|ORA-\d{5})/ },
];

export function checkResponseHeaders(url: string, headers: Headers): RawCheckFinding[] {
  const out: RawCheckFinding[] = [];
  const host = new URL(url).hostname;

  const required: Array<{ header: string; title: string }> = [
    { header: "x-content-type-options", title: "Header X-Content-Type-Options tidak ada" },
    { header: "x-frame-options", title: "Header X-Frame-Options tidak ada (risiko clickjacking)" },
    { header: "content-security-policy", title: "Header Content-Security-Policy tidak ada" },
  ];
  for (const r of required) {
    if (!headers.get(r.header)) {
      out.push({
        title: r.title,
        category: "header",
        normalizedKey: `header:${host}:${r.header}:missing`,
        rawPayload: { url, header: r.header },
      });
    }
  }

  if (url.startsWith("https:") && !headers.get("strict-transport-security")) {
    out.push({
      title: "Header Strict-Transport-Security tidak ada pada koneksi HTTPS",
      category: "header",
      normalizedKey: `header:${host}:hsts:missing`,
      rawPayload: { url },
    });
  }

  const server = headers.get("server");
  if (server && VERSION_BANNER_RE.test(server)) {
    out.push({
      title: `Header Server membuka versi perangkat lunak (${server})`,
      category: "info_disclosure",
      normalizedKey: `info:${host}:server_banner`,
      rawPayload: { url, server },
    });
  }

  const poweredBy = headers.get("x-powered-by");
  if (poweredBy) {
    out.push({
      title: `Header X-Powered-By membuka teknologi backend (${poweredBy})`,
      category: "info_disclosure",
      normalizedKey: `info:${host}:x_powered_by`,
      rawPayload: { url, poweredBy },
    });
  }

  // Set-Cookie flags
  const setCookie = headers.get("set-cookie");
  if (setCookie) {
    const lower = setCookie.toLowerCase();
    const missing: string[] = [];
    if (!lower.includes("httponly")) missing.push("HttpOnly");
    if (url.startsWith("https:") && !lower.includes("secure")) missing.push("Secure");
    if (!lower.includes("samesite")) missing.push("SameSite");
    if (missing.length > 0) {
      out.push({
        title: `Cookie tanpa atribut aman: ${missing.join(", ")}`,
        category: "cookie",
        normalizedKey: `cookie:${host}:flags_missing:${missing.sort().join("_")}`,
        rawPayload: { url, missingFlags: missing }, // nilai cookie asli TIDAK disimpan mentah
      });
    }
  }

  return out;
}

export function checkResponseBody(url: string, body: string): RawCheckFinding[] {
  const out: RawCheckFinding[] = [];
  const host = new URL(url).hostname;
  const truncated = body.slice(0, 20000); // batasi payload yang disimpan

  for (const p of INFO_DISCLOSURE_BODY_PATTERNS) {
    if (p.re.test(truncated)) {
      out.push({
        title: `Informasi teknis tidak sengaja terbuka di body respons (${p.name})`,
        category: "info_disclosure",
        normalizedKey: `info:${host}:body:${p.name}`,
        rawPayload: { url, pattern: p.name },
      });
    }
  }
  return out;
}

/** Spider sangat terbatas: ambil link <a href> same-origin dari HTML, maksimal N. */
export function extractSameOriginLinks(baseUrl: string, html: string, max = 15): string[] {
  const base = new URL(baseUrl);
  const links = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && links.size < max) {
    try {
      const abs = new URL(match[1], base);
      if (abs.hostname === base.hostname && ["http:", "https:"].includes(abs.protocol)) {
        links.add(abs.toString());
      }
    } catch {
      // ignore invalid href
    }
  }
  return Array.from(links);
}
