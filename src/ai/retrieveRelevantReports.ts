import { loadSavedPostMatchReports } from "./post-match/storage.js";
import { rankDocuments } from "./retrievalScoring.js";

const MAX_REPORT_ITEMS = 3;

export async function retrieveRelevantReports(userInput: string) {
  const reports = await loadSavedPostMatchReports();
  const documents = reports.map((savedReport) => {
    const report = savedReport.report;
    const date = report.matchContext.date ?? savedReport.savedAt.slice(0, 10);
    const title = `${date} vs ${report.matchContext.opponent} (${report.matchContext.result})`;
    const text = [
      title,
      report.executiveSummary,
      report.matchStory,
      ...report.ownStrengths.map((item) => item.strength),
      ...report.ownTeamProblems.map((item) => item.problem),
      ...report.rivalVulnerabilities.map((item) => item.vulnerability),
      ...report.tacticalTradeoffs.map((item) => item.decision),
      ...report.flankAsymmetries.map((item) => item.description),
      ...report.keyPatterns.map((item) => item.pattern),
      ...report.saturdayFocus,
      ...report.risksOfOvercorrection,
      savedReport.sourceInput?.staffNotes ?? "",
      ...(savedReport.sourceInput?.tags ?? []).map((tag) =>
        [tag.minute != null ? `${tag.minute}'` : "", tag.label, tag.zone, tag.note]
          .filter(Boolean)
          .join(" | "),
      ),
    ].join("\n");

    return {
      id: `REP-${savedReport.id}`,
      sourceType: "report" as const,
      title,
      text,
      tags: [
        report.matchContext.opponent,
        report.matchContext.ownSystem,
        report.matchContext.opponentSystem ?? "",
        report.matchContext.interpretedResult?.outcome ?? "",
      ].filter(Boolean),
      payload: savedReport,
      recencyScore: getRecencyScore(date),
      authorityScore: 0.9,
    };
  });

  return rankDocuments(userInput, documents, {
    limit: MAX_REPORT_ITEMS,
    minScore: 0.06,
  });
}

function getRecencyScore(date: string) {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 0.2;
  const daysAgo = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 10) return 1;
  if (daysAgo <= 35) return 0.75;
  if (daysAgo <= 120) return 0.45;
  return 0.15;
}
