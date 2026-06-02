import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import type { CoachMatchAdvice } from "@/ai/CoachSchemas";
import type { GameModel } from "@/data/gameModel";
import type { Session } from "@/data";
import type { OpponentGamePlan, OpponentScout } from "@/scout/opponentScout";

export function exportCoachDiagnosisHtml(advice: CoachMatchAdvice) {
  openPrintDocument(
    "Diagnostico tactico",
    [
      section("Lectura", [advice.tacticalReading]),
      section("Desglose", [
        `Zona: ${advice.problemBreakdown.zone}`,
        `Momento: ${advice.problemBreakdown.moment}`,
        `Gatillo: ${advice.problemBreakdown.trigger}`,
        `Propio/rival: ${advice.problemBreakdown.ownVsRival}`,
      ]),
      section("Ajuste principal", [advice.mainAdjustment]),
      section(
        "Alternativas",
        advice.alternativeAdjustments.map(
          (item) =>
            `${item.adjustment} | Usar cuando: ${item.whenToUse} | Costo: ${item.tradeoff}`,
        ),
      ),
      section("Instrucciones de campo", advice.onFieldInstructions),
      section("Riesgos", advice.adjustmentRisks),
      section("Senales de exito", advice.successSignals),
    ].join(""),
  );
}

export function exportMatchPlanHtml({
  scout,
  plan,
  gameModel,
}: {
  scout: OpponentScout;
  plan: OpponentGamePlan;
  gameModel: GameModel;
}) {
  openPrintDocument(
    `Plan de partido - ${scout.rival}`,
    [
      section("Rival", [
        `Sistema probable: ${scout.probableSystem || "sin confirmar"}`,
        `Modelo propio: ${gameModel.identity}`,
      ]),
      section("Plan base", plan.plan),
      section("Como atacarlo", plan.attackIt),
      section("Como defenderlo", plan.defendIt),
      section("Alertas", plan.matchAlerts),
      section("Preguntas pendientes", plan.openQuestions),
    ].join(""),
  );
}

export function exportTrainingWeekHtml(session: Session) {
  openPrintDocument(
    `Semana de entrenamiento - ${session.name}`,
    [
      section("Resumen", [
        `${session.blocks.length} bloques`,
        `${session.computed?.totalDuration ?? 0} minutos`,
        `Carga estimada ${session.computed?.totalLoad ?? 0}`,
      ]),
      section("Objetivos", session.computed?.primaryObjectives ?? []),
      section("Notas staff", [session.staffNotes || "Sin notas."]),
    ].join(""),
  );
}

export function exportEvolutionHtml(reports: SavedPostMatchReport[]) {
  openPrintDocument(
    "Evolucion del equipo",
    reports
      .slice(0, 8)
      .map((saved) =>
        section(
          `${saved.report.matchContext.date ?? saved.savedAt.slice(0, 10)} vs ${saved.report.matchContext.opponent}`,
          [
            saved.report.executiveSummary,
            ...saved.report.mainProblems.map((item) => `Problema: ${item.problem}`),
            ...saved.report.positives.map((item) => `Positivo: ${item}`),
          ],
        ),
      )
      .join(""),
  );
}

function section(title: string, items: string[]) {
  const list = items.filter(Boolean);
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${
        list.length
          ? `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
          : "<p>Sin datos.</p>"
      }
    </section>
  `;
}

function openPrintDocument(title: string, body: string) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 40px; }
    h1 { font-size: 28px; margin: 0 0 20px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; margin-top: 24px; }
    section { border-top: 1px solid #d1d5db; padding-top: 12px; }
    li { margin: 8px 0; line-height: 1.45; }
    @media print { body { margin: 22mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
  <script>window.print()</script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
