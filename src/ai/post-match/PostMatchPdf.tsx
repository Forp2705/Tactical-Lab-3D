import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import {
  getAcceptanceCriteria,
  getOwnTeamProblems,
  humanizeEvidenceList,
  humanizeReportText,
  memoryCategoryLabel,
  memoryScopeLabel,
  subjectLabel,
} from "./reportPresentation";
import type { PostMatchReport } from "./schemas";

type PdfProps = {
  report: PostMatchReport;
  staffReviewNotes?: string;
};

export async function downloadPostMatchPdf(
  report: PostMatchReport,
  staffReviewNotes?: string,
) {
  const blob = await pdf(
    <PostMatchPdfDocument
      report={report}
      staffReviewNotes={staffReviewNotes}
    />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const opponent = sanitizeFilePart(report.matchContext.opponent);
  const date = sanitizeFilePart(report.matchContext.date ?? "sin-fecha");

  link.href = url;
  link.download = `post-match-${date}-${opponent}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PostMatchPdfDocument({ report, staffReviewNotes }: PdfProps) {
  const ownTeamProblems = getOwnTeamProblems(report);
  const acceptanceCriteria = getAcceptanceCriteria(report);

  return (
    <Document
      author="Tactical Lab 3D"
      subject="Post-match tactical report"
      title={`Post-match report - ${report.matchContext.opponent}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TACTICAL LAB 3D</Text>
          <Text style={styles.title}>Reporte post-partido</Text>
          <Text style={styles.subtitle}>
            {report.matchContext.opponent} | {report.matchContext.result}
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <Meta label="Resultado" value={report.matchContext.result} />
          <Meta
            label="Interpretacion"
            value={
              report.matchContext.interpretedResult?.label ??
              report.grounding.resultPerspective
            }
          />
          <Meta label="Sistema propio" value={report.matchContext.ownSystem} />
          <Meta
            label="Sistema rival"
            value={report.matchContext.opponentSystem}
          />
          <Meta label="Sede / contexto" value={report.matchContext.venue} />
          <Meta label="Competencia" value={report.matchContext.competition} />
          <Meta label="Fecha" value={report.matchContext.date} />
          <Meta label="Generado" value={report.createdAt} />
        </View>

        <TextSection
          title="Resumen ejecutivo"
          value={report.executiveSummary}
        />
        <TextSection
          title="Resultado interpretado"
          value={
            report.matchContext.interpretedResult?.label ??
            report.grounding.resultPerspective
          }
        />
        <ListSection
          title="Contexto condicionante"
          items={report.conditioningContext}
        />
        <TextSection title="Historia del partido" value={report.matchStory} />
        <ListSection title="Lecturas positivas" items={report.positives} />

        <EvidenceSection
          title="Fortalezas propias"
          items={report.ownStrengths.map((item) => ({
            title: item.strength,
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Vulnerabilidades del rival"
          items={report.rivalVulnerabilities.map((item) => ({
            title: item.vulnerability,
            body: item.howWeExploitedIt,
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Riesgos observados"
          items={report.observedRisks.map((item) => ({
            title: `${item.risk} (${subjectLabel(item.owner)})`,
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Problemas propios principales"
          items={ownTeamProblems.map((item) => ({
            title: `${item.problem} (${item.severity})`,
            body: item.probableCause,
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Tradeoffs tacticos"
          items={report.tacticalTradeoffs.map((item) => ({
            title: `${item.decision} (${subjectLabel(item.subject)})`,
            body: `Ventaja: ${item.upside}\nCosto: ${item.downside}`,
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Asimetrias por banda"
          items={report.flankAsymmetries.map((item) => ({
            title: `${item.flank} (${subjectLabel(item.subject)})`,
            body: [item.description, item.implication]
              .filter(Boolean)
              .join("\n"),
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Patrones detectados"
          items={report.keyPatterns.map((item) => ({
            title: item.pattern,
            body: item.tacticalImpact,
            evidence: item.evidence,
          }))}
        />
        <EvidenceSection
          title="Inferencias tacticas"
          items={report.tacticalInferences.map((item) => ({
            title: `${item.inference} (${item.confidence})`,
            evidence: item.basedOn,
          }))}
        />
        <EvidenceSection
          title="Influencia de memoria previa"
          items={report.memoryInfluence.map((item) => ({
            title: item.memoryItem,
            body:
              item.usedAs === "supportedByCurrentEvidence"
                ? "Confirmada por evidencia actual."
                : "Usada solo como contexto, no como conclusion.",
            evidence: item.currentEvidence,
          }))}
        />

        <EvidenceSection
          title="Prioridades de entrenamiento"
          items={report.wednesdayTest.map((item) => ({
            title: item.hypothesis,
            body: `${item.test}${
              item.fallbackIfFails ? `\nFallback: ${item.fallbackIfFails}` : ""
            }`,
            evidence: item.successSignals,
          }))}
        />
        <ListSection
          title="Foco para el proximo partido"
          items={report.saturdayFocus}
        />
        <ListSection
          title="Riesgos de sobrerreaccion"
          items={report.risksOfOvercorrection}
        />
        <ListSection
          title="Informacion faltante"
          items={report.missingInformation}
        />
        <ListSection
          title="Claims no sostenidos"
          items={report.grounding.unsupportedClaims}
        />
        <ListSection
          title="Alertas de atribucion"
          items={report.grounding.subjectAttributionWarnings}
        />

        <EvidenceSection
          title="Candidatos de memoria (no aplicados automaticamente)"
          items={report.memoryCandidates.map((candidate) => ({
            title: `${candidate.statement} (${memoryCategoryLabel(
              candidate.category,
            )} | ${candidate.confidence})`,
            body: memoryScopeLabel(candidate.scope),
            evidence: candidate.evidence,
          }))}
        />

        <TextSection
          title="Reflexion / confianza"
          value={[
            report.reflection.mainUncertainty,
            report.reflection.alternativeInterpretation,
            `Confianza: ${Math.round(report.reflection.confidence * 100)}%`,
          ].join("\n")}
        />
        <ListSection
          title="Criterios de aceptacion"
          items={acceptanceCriteria}
        />
        {staffReviewNotes?.trim() ? (
          <TextSection title="Revision del staff" value={staffReviewNotes} />
        ) : null}
      </Page>
    </Document>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function TextSection({ title, value }: { title: string; value?: string }) {
  if (!value?.trim()) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{humanizeReportText(value)}</Text>
    </View>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <Text style={styles.bullet} key={`${title}-${index}-${item}`}>
          - {humanizeReportText(item)}
        </Text>
      ))}
    </View>
  );
}

function EvidenceSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ title: string; body?: string; evidence: string[] }>;
}) {
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, index) => (
        <View style={styles.itemCard} key={`${title}-${index}-${item.title}`}>
          <Text style={styles.itemTitle}>{humanizeReportText(item.title)}</Text>
          {item.body ? (
            <Text style={styles.paragraph}>
              {humanizeReportText(item.body)}
            </Text>
          ) : null}
          {humanizeEvidenceList(item.evidence).map((entry, evidenceIndex) => (
            <Text
              style={styles.evidence}
              key={`${item.title}-${evidenceIndex}-${entry}`}
            >
              Evidencia: {entry}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: "#f6f2e8",
    color: "#17211b",
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.35,
  },
  header: {
    borderBottom: "2px solid #c77a34",
    marginBottom: 16,
    paddingBottom: 12,
  },
  eyebrow: {
    color: "#c77a34",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginTop: 4,
  },
  subtitle: {
    color: "#516057",
    fontSize: 11,
    marginTop: 4,
  },
  metaGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  metaItem: {
    backgroundColor: "#fffaf0",
    border: "1px solid #eadcc5",
    borderRadius: 7,
    padding: 8,
    width: "31.5%",
  },
  metaLabel: {
    color: "#7a5a35",
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 10,
    marginTop: 3,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#0f3f34",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 5,
  },
  paragraph: {
    marginBottom: 4,
    whiteSpace: "pre-wrap",
  },
  itemCard: {
    backgroundColor: "#fffaf0",
    border: "1px solid #eadcc5",
    borderRadius: 7,
    marginBottom: 6,
    padding: 8,
  },
  itemTitle: {
    fontWeight: 700,
    marginBottom: 3,
  },
  evidence: {
    color: "#5b655f",
    fontSize: 8,
    marginTop: 2,
  },
  bullet: {
    marginBottom: 3,
  },
});
