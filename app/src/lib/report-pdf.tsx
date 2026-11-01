import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { maskText } from "@/lib/mask";
import { SEVERITY_COLOR, type Severity } from "@/lib/cvss4";
import { formatDate } from "@/lib/utils";

/**
 * Generator PDF laporan teknis & eksekutif (server-side, Node runtime).
 * Semua teks bebas (title/description/steps/impact/ownerResponse) WAJIB sudah lewat
 * maskText/maskJson sebelum masuk ke sini — dipanggil ulang di sini juga sebagai jaga-jaga.
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  coverTitle: { fontSize: 22, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  coverSub: { fontSize: 12, marginBottom: 4, color: "#374151" },
  h1: { fontSize: 16, marginBottom: 10, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 12, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  section: { marginBottom: 16 },
  findingBlock: { marginBottom: 14, paddingBottom: 10, borderBottom: "1pt solid #d1d5db" },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: 90, color: "#6b7280" },
  value: { flex: 1 },
  severityTag: { fontFamily: "Helvetica-Bold" },
  small: { fontSize: 9, color: "#6b7280" },
  ratingBox: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ratingText: { fontSize: 28, fontFamily: "Helvetica-Bold" },
});

export type TechnicalFindingInput = {
  title: string;
  severity: Severity | string;
  status: string;
  cvssScore: number | null;
  cvssVector: string | null;
  description: string;
  steps: string | null;
  impact: string | null;
  latestEvidence: { versionNo: number; sha256: string; createdAt: Date } | null;
};

export type ExecutiveFindingInput = {
  title: string;
  severity: Severity | string;
  impact: string | null;
};

const m = (s: string | null | undefined) => maskText(s ?? "");

function severityColor(s: string): string {
  return SEVERITY_COLOR[(s as Severity) in SEVERITY_COLOR ? (s as Severity) : "info"];
}

export async function buildTechnicalReportPdf(input: {
  appName: string;
  generatedAt: Date;
  findings: TechnicalFindingInput[];
}): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Laporan Teknis — {m(input.appName)}</Text>
        <Text style={[styles.small, { marginBottom: 16 }]}>Dicetak: {formatDate(input.generatedAt)}</Text>

        {input.findings.length === 0 ? (
          <Text>Belum ada temuan untuk aplikasi ini.</Text>
        ) : (
          input.findings.map((f, i) => (
            <View key={i} style={styles.findingBlock}>
              <Text style={styles.h2}>
                {i + 1}. {m(f.title)}
              </Text>
              <View style={styles.row}>
                <Text style={styles.label}>Severity</Text>
                <Text style={[styles.value, styles.severityTag, { color: severityColor(f.severity) }]}>
                  {String(f.severity).toUpperCase()}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>CVSS</Text>
                <Text style={styles.value}>
                  {f.cvssScore != null ? `${f.cvssScore.toFixed(1)} — ${f.cvssVector ?? "-"}` : "Belum diskor"}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Status</Text>
                <Text style={styles.value}>{f.status}</Text>
              </View>
              <View style={{ marginTop: 4 }}>
                <Text style={styles.label}>Deskripsi</Text>
                <Text style={styles.value}>{m(f.description)}</Text>
              </View>
              {f.steps && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.label}>Langkah Reproduksi</Text>
                  <Text style={styles.value}>{m(f.steps)}</Text>
                </View>
              )}
              {f.impact && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.label}>Dampak</Text>
                  <Text style={styles.value}>{m(f.impact)}</Text>
                </View>
              )}
              <View style={{ marginTop: 6 }}>
                <Text style={styles.small}>
                  {f.latestEvidence
                    ? `Bukti versi ${f.latestEvidence.versionNo}, sha256: ${f.latestEvidence.sha256} (${formatDate(f.latestEvidence.createdAt)})`
                    : "Belum ada bukti yang diunggah."}
                </Text>
              </View>
            </View>
          ))
        )}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}

export async function buildExecutiveReportPdf(input: {
  appName: string;
  rating: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  printedAt: Date;
  severityCounts: Record<string, number>;
  openCount: number;
  doneCount: number;
  topFindings: ExecutiveFindingInput[];
}): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.coverTitle}>Laporan Eksekutif</Text>
        <Text style={styles.coverSub}>{m(input.appName)}</Text>
        <Text style={styles.coverSub}>
          Periode uji: {input.periodStart ? formatDate(input.periodStart) : "-"} s.d.{" "}
          {input.periodEnd ? formatDate(input.periodEnd) : "-"}
        </Text>
        <Text style={[styles.coverSub, { marginBottom: 20 }]}>Tanggal cetak: {formatDate(input.printedAt)}</Text>

        <Text style={styles.h2}>Rating Keamanan Aplikasi</Text>
        <View style={styles.ratingBox}>
          <Text style={styles.ratingText}>{input.rating ?? "-"}</Text>
        </View>

        <Text style={styles.h2}>Ringkasan Temuan</Text>
        <View style={{ marginBottom: 12 }}>
          {Object.entries(input.severityCounts).map(([sev, count]) => (
            <View key={sev} style={styles.row}>
              <Text style={[styles.label, { color: severityColor(sev) }]}>{sev.toUpperCase()}</Text>
              <Text style={styles.value}>{count} temuan</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.label}>Terbuka</Text>
            <Text style={styles.value}>{input.openCount} temuan</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Selesai</Text>
            <Text style={styles.value}>{input.doneCount} temuan</Text>
          </View>
        </View>

        <Text style={styles.h2}>Risiko Utama</Text>
        {input.topFindings.length === 0 ? (
          <Text style={styles.small}>Tidak ada risiko critical/high yang perlu disorot saat ini.</Text>
        ) : (
          input.topFindings.map((f, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: severityColor(f.severity) }}>
                {i + 1}. {m(f.title)}
              </Text>
              <Text style={styles.small}>{m(f.impact) || "Berpotensi mengganggu kerahasiaan/keutuhan data aplikasi."}</Text>
            </View>
          ))
        )}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
