import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import type { TacticalDomain } from "@/ai/CoachSchemas";
import type { GameModel } from "@/data/gameModel";

export type TeamPatternKind =
  | "repeatedProblem"
  | "newProblem"
  | "improvement"
  | "regression"
  | "problemNotTrained"
  | "gameModelContradiction";

export type TeamPattern = {
  id: string;
  kind: TeamPatternKind;
  domain: TacticalDomain;
  statement: string;
  evidence: string[];
  reportIds: string[];
  confidence: "low" | "medium" | "high";
};

type ProblemRecord = {
  reportId: string;
  date: string;
  opponent: string;
  text: string;
  severity: "low" | "medium" | "high";
  domain: TacticalDomain;
};

export function detectTeamPatterns(
  reports: SavedPostMatchReport[],
  options: {
    limit?: number;
    sessionObjectives?: string[];
    gameModel?: GameModel;
  } = {},
): TeamPattern[] {
  if (reports.length < 1) return [];

  const sorted = [...reports].sort((a, b) =>
    getReportDate(b).localeCompare(getReportDate(a)),
  );
  const records = sorted.flatMap(extractProblemRecords);
  const patterns: TeamPattern[] = [];

  patterns.push(...detectRepeatedProblems(records));
  patterns.push(...detectNewProblems(sorted, records));
  patterns.push(...detectImprovements(sorted, records));
  patterns.push(...detectRegressions(records));
  patterns.push(...detectProblemsNotTrained(records, options.sessionObjectives ?? []));
  if (options.gameModel) {
    patterns.push(...detectGameModelContradictions(records, options.gameModel));
  }

  return dedupePatterns(patterns).slice(0, options.limit ?? 6);
}

export function formatPatternsForCoach(patterns: TeamPattern[]) {
  if (!patterns.length) return "No cross-report patterns detected.";

  return patterns
    .map(
      (pattern) =>
        `- ${labelForKind(pattern.kind)} / ${pattern.domain} / ${pattern.confidence}: ${pattern.statement} | evidencia: ${pattern.evidence.join("; ")}`,
    )
    .join("\n");
}

function detectRepeatedProblems(records: ProblemRecord[]): TeamPattern[] {
  const patterns: TeamPattern[] = [];

  for (const [domain, domainRecords] of groupBy(records, (record) => record.domain)) {
    for (const cluster of clusterSimilar(domainRecords)) {
      if (cluster.length < 2) continue;
      patterns.push({
        id: `repeat-${domain}-${hashText(cluster[0].text)}`,
        kind: "repeatedProblem",
        domain,
        statement: `Problema repetido: ${cluster[0].text}`,
        evidence: cluster.map((item) => `${item.date} vs ${item.opponent}`),
        reportIds: cluster.map((item) => item.reportId),
        confidence: cluster.length >= 3 ? "high" : "medium",
      });
    }
  }

  return patterns;
}

function detectNewProblems(
  sortedReports: SavedPostMatchReport[],
  records: ProblemRecord[],
): TeamPattern[] {
  const latest = sortedReports[0];
  if (!latest) return [];
  const latestRecords = records.filter((record) => record.reportId === latest.id);
  const previous = records.filter((record) => record.reportId !== latest.id);

  return latestRecords
    .filter(
      (record) =>
        !previous.some(
          (item) => item.domain === record.domain && similarity(item.text, record.text) >= 0.32,
        ),
    )
    .slice(0, 2)
    .map((record) => ({
      id: `new-${record.domain}-${hashText(record.text)}`,
      kind: "newProblem" as const,
      domain: record.domain,
      statement: `Problema nuevo observado: ${record.text}`,
      evidence: [`${record.date} vs ${record.opponent}`],
      reportIds: [record.reportId],
      confidence: "low" as const,
    }));
}

function detectImprovements(
  sortedReports: SavedPostMatchReport[],
  records: ProblemRecord[],
): TeamPattern[] {
  const latest = sortedReports[0];
  if (!latest || sortedReports.length < 2) return [];
  const latestText = normalize(reportText(latest));
  const latestRecords = records.filter((record) => record.reportId === latest.id);
  const previous = records.filter((record) => record.reportId !== latest.id);

  return previous
    .filter((record) => !latestRecords.some((item) => similarity(item.text, record.text) >= 0.32))
    .filter((record) =>
      ["mejor", "corrig", "solucion", "progreso", "mas compacto"].some((term) =>
        latestText.includes(term),
      ),
    )
    .slice(0, 2)
    .map((record) => ({
      id: `improvement-${record.domain}-${hashText(record.text)}`,
      kind: "improvement" as const,
      domain: record.domain,
      statement: `Posible mejora: no reaparece "${record.text}" en el ultimo reporte.`,
      evidence: [`Antes: ${record.date} vs ${record.opponent}`, `Ultimo: ${getReportDate(latest)} vs ${latest.report.matchContext.opponent}`],
      reportIds: [record.reportId, latest.id],
      confidence: "low" as const,
    }));
}

function detectRegressions(records: ProblemRecord[]): TeamPattern[] {
  const patterns: TeamPattern[] = [];

  for (const cluster of clusterSimilar(records)) {
    if (cluster.length < 2) continue;
    const sorted = [...cluster].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted.at(-1);
    if (!first || !last) continue;
    if (severityScore(last.severity) > severityScore(first.severity)) {
      patterns.push({
        id: `regression-${last.domain}-${hashText(last.text)}`,
        kind: "regression",
        domain: last.domain,
        statement: `Retroceso posible: "${last.text}" subio de severidad.`,
        evidence: [
          `${first.date} vs ${first.opponent}: ${first.severity}`,
          `${last.date} vs ${last.opponent}: ${last.severity}`,
        ],
        reportIds: [first.reportId, last.reportId],
        confidence: "medium",
      });
    }
  }

  return patterns;
}

function detectProblemsNotTrained(
  records: ProblemRecord[],
  sessionObjectives: string[],
): TeamPattern[] {
  if (!sessionObjectives.length) return [];
  const trainedText = normalize(sessionObjectives.join(" "));
  const recent = records.slice(0, 8);

  return recent
    .filter((record) => similarity(record.text, trainedText) < 0.18)
    .slice(0, 2)
    .map((record) => ({
      id: `not-trained-${record.domain}-${hashText(record.text)}`,
      kind: "problemNotTrained" as const,
      domain: record.domain,
      statement: `Sigue apareciendo sin foco claro en la sesion activa: ${record.text}`,
      evidence: [`${record.date} vs ${record.opponent}`],
      reportIds: [record.reportId],
      confidence: "low" as const,
    }));
}

function detectGameModelContradictions(
  records: ProblemRecord[],
  gameModel: GameModel,
): TeamPattern[] {
  const normalizedModel = normalize(
    [
      gameModel.identity,
      ...gameModel.nonNegotiables,
      ...gameModel.defensivePrinciples,
      gameModel.pressing.height,
    ].join(" "),
  );

  return records
    .filter((record) => {
      const text = normalize(record.text);
      return (
        (normalizedModel.includes("presion") &&
          hasAny(text, ["no presiona", "repliegue bajo", "bloque bajo"])) ||
        (normalizedModel.includes("partido") &&
          hasAny(text, ["bloque partido", "entre lineas", "distancia"])) ||
        (normalizedModel.includes("9") &&
          hasAny(text, ["9 aislado", "delantero aislado", "sin apoyos"]))
      );
    })
    .slice(0, 3)
    .map((record) => ({
      id: `model-contradiction-${record.domain}-${hashText(record.text)}`,
      kind: "gameModelContradiction" as const,
      domain: record.domain,
      statement: `Contradice el modelo de juego: ${record.text}`,
      evidence: [`${record.date} vs ${record.opponent}`],
      reportIds: [record.reportId],
      confidence: "medium" as const,
    }));
}

function extractProblemRecords(savedReport: SavedPostMatchReport): ProblemRecord[] {
  const report = savedReport.report;
  const date = getReportDate(savedReport);
  const opponent = report.matchContext.opponent;
  const ownTeamProblems = report.ownTeamProblems.map((item) => ({
    text: item.problem,
    severity: item.severity,
  }));
  const mainProblems = report.mainProblems.map((item) => ({
    text: item.problem,
    severity: item.severity,
  }));

  return [...ownTeamProblems, ...mainProblems].map((item) => ({
    reportId: savedReport.id,
    date,
    opponent,
    text: item.text,
    severity: item.severity,
    domain: inferDomain(item.text),
  }));
}

function inferDomain(text: string): TacticalDomain {
  const normalized = normalize(text);
  if (hasAny(normalized, ["salida", "constru", "progres"])) return "buildUp";
  if (hasAny(normalized, ["presion", "saltar", "orientar"])) return "pressing";
  if (hasAny(normalized, ["transicion", "perdida", "retroceso"])) return "defensiveTransition";
  if (hasAny(normalized, ["abp", "corner", "pelota parada"])) return "setPieces";
  if (hasAny(normalized, ["duelo", "banda", "1v1"])) return "duels";
  if (hasAny(normalized, ["ataque", "gener", "9", "finaliz"])) return "attack";
  if (hasAny(normalized, ["bloque", "hund", "largo", "partido", "lineas"])) return "block";
  return "defense";
}

function clusterSimilar(records: ProblemRecord[]) {
  const clusters: ProblemRecord[][] = [];

  for (const record of records) {
    const cluster = clusters.find((items) =>
      items.some((item) => similarity(item.text, record.text) >= 0.32),
    );
    if (cluster) cluster.push(record);
    else clusters.push([record]);
  }

  return clusters;
}

function similarity(a: string, b: string) {
  const aTokens = new Set(tokens(a));
  const bTokens = new Set(tokens(b));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union ? intersection / union : 0;
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter((token) => token.length > 3);
}

function reportText(savedReport: SavedPostMatchReport) {
  const report = savedReport.report;
  return [
    report.executiveSummary,
    report.matchStory,
    ...report.positives,
    ...report.ownStrengths.map((item) => item.strength),
  ].join(" ");
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

function dedupePatterns(patterns: TeamPattern[]) {
  return [...new Map(patterns.map((pattern) => [pattern.id, pattern])).values()];
}

function getReportDate(savedReport: SavedPostMatchReport) {
  return savedReport.report.matchContext.date ?? savedReport.savedAt.slice(0, 10);
}

function severityScore(severity: "low" | "medium" | "high") {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

function labelForKind(kind: TeamPatternKind) {
  const labels: Record<TeamPatternKind, string> = {
    repeatedProblem: "problema repetido",
    newProblem: "problema nuevo",
    improvement: "mejora posible",
    regression: "retroceso posible",
    problemNotTrained: "problema no entrenado",
    gameModelContradiction: "contradice modelo",
  };
  return labels[kind];
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function hashText(value: string) {
  let hash = 0;
  for (const char of normalize(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
