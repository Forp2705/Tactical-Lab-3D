import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import type { CoachMatchAdvice } from "@/ai/CoachSchemas";
import type { GameModel } from "@/data/gameModel";
import type { Session } from "@/data";
import type { OpponentGamePlan, OpponentScout } from "@/scout/opponentScout";

export function exportCoachDiagnosisHtml(
  advice: CoachMatchAdvice,
  options?: {
    prompt?: string;
    teamName?: string;
  },
) {
  const confidence = Math.round(advice.reflection.confidence * 100);
  openStyledDocument({
    title: "Diagnostico tactico semanal",
    subtitle:
      options?.teamName ??
      "RomboIQ / weekly tactical operating system para un staff corto",
    kicker: options?.prompt ? `Consulta: ${options.prompt}` : "Decision de la semana",
    body: [
      metricStrip([
        ["Confianza", `${confidence}%`],
        ["Ajuste principal", advice.mainAdjustment],
        ["Test de mitad de semana", advice.wednesdayTest],
      ]),
      proseSection("Lectura principal", advice.tacticalReading),
      splitSection(
        "Decision operativa",
        [
          cardBlock("Causa probable", [advice.probableCause]),
          cardBlock("Ajuste recomendado", [advice.mainAdjustment]),
          cardBlock("Que sabe", [
            advice.evidenceCitations.length
              ? `${advice.evidenceCitations.length} fuente(s) citadas en la respuesta.`
              : "No hay fuentes citadas en esta respuesta.",
          ]),
          cardBlock("Que falta", [
            advice.reflection.missingInformation,
            advice.reflection.mainUncertainty,
          ]),
        ],
      ),
      splitSection(
        "Desglose del problema",
        [
          cardBlock("Zona", [advice.problemBreakdown.zone]),
          cardBlock("Momento", [advice.problemBreakdown.moment]),
          cardBlock("Gatillo", [advice.problemBreakdown.trigger]),
          cardBlock("Responsabilidad", [advice.problemBreakdown.ownVsRival]),
        ],
      ),
      listSection("Instrucciones de campo", advice.onFieldInstructions),
      listSection("Riesgos del ajuste", advice.adjustmentRisks),
      listSection("Senales de exito", advice.successSignals),
      listSection(
        "Alternativas",
        advice.alternativeAdjustments.map(
          (item) =>
            `${item.adjustment} | usar cuando: ${item.whenToUse} | costo: ${item.tradeoff}`,
        ),
      ),
      listSection(
        "Evidencia utilizada",
        advice.evidenceCitations.map(
          (citation) =>
            `${citation.title} (${citation.sourceType}) - ${citation.excerpt}`,
        ),
      ),
      footerBlock(
        "Este reporte no reemplaza la decision del staff. Si la evidencia es debil, la recomendacion debe usarse como hipotesis de trabajo y no como verdad cerrada.",
      ),
    ].join(""),
  });
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
  openStyledDocument({
    title: `Plan de partido - ${scout.rival}`,
    subtitle: "RomboIQ / plan semanal",
    kicker: "Scouting rival + identidad propia",
    body: [
      metricStrip([
        ["Rival", scout.rival],
        ["Sistema probable", scout.probableSystem || "Sin confirmar"],
        ["Modelo propio", gameModel.identity],
      ]),
      listSection("Plan base", Array.isArray(plan.plan) ? plan.plan : [plan.plan]),
      splitSection(
        "Ajustes clave",
        [
          cardBlock(
            "Como atacarlo",
            Array.isArray(plan.attackIt) ? plan.attackIt : [plan.attackIt],
          ),
          cardBlock(
            "Como defenderlo",
            Array.isArray(plan.defendIt) ? plan.defendIt : [plan.defendIt],
          ),
        ],
      ),
      listSection("Alertas", plan.matchAlerts),
      listSection("Preguntas pendientes", plan.openQuestions),
    ].join(""),
  });
}

export function exportTrainingWeekHtml(session: Session) {
  openStyledDocument({
    title: `Semana de entrenamiento - ${session.name}`,
    subtitle: "RomboIQ / plan semanal",
    kicker: "Sesion conectada al problema tactico",
    body: [
      metricStrip([
        ["Bloques", String(session.blocks.length)],
        ["Minutos", String(session.computed?.totalDuration ?? 0)],
        ["Carga", String(session.computed?.totalLoad ?? 0)],
      ]),
      listSection("Objetivos", session.computed?.primaryObjectives ?? []),
      proseSection("Notas del staff", session.staffNotes || "Sin notas."),
    ].join(""),
  });
}

export function exportEvolutionHtml(reports: SavedPostMatchReport[]) {
  openStyledDocument({
    title: "Evolucion del equipo",
    subtitle: "RomboIQ / timeline tactico",
    kicker: "Lo que se repite, mejora o cambia",
    body: reports
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
  });
}

function openStyledDocument({
  title,
  subtitle,
  kicker,
  body,
}: {
  title: string;
  subtitle: string;
  kicker: string;
  body: string;
}) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  win.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #102016;
      --muted: #4f6356;
      --line: #d4ddd6;
      --panel: #f4f8f5;
      --accent: #0f8a43;
      --accent-soft: #e7f5ec;
      --warn: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      background: linear-gradient(180deg, #f7faf8, #eef4f0);
    }
    .page {
      max-width: 980px;
      margin: 0 auto;
      padding: 36px 40px 48px;
    }
    .hero {
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      background:
        radial-gradient(circle at top right, rgba(15, 138, 67, 0.16), transparent 32%),
        linear-gradient(180deg, #ffffff, #f3f8f4);
    }
    .kicker {
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    h1 {
      margin: 10px 0 6px;
      font-size: 34px;
      line-height: 1.02;
      letter-spacing: -0.04em;
    }
    .subtitle {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
      max-width: 64ch;
    }
    .metric-strip,
    .split-grid {
      display: grid;
      gap: 12px;
      margin-top: 20px;
    }
    .metric-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .split-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .metric,
    .card {
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 16px 18px;
      background: #ffffff;
    }
    .metric span,
    .card span,
    section h2 {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .metric b,
    .card b {
      display: block;
      font-size: 18px;
      line-height: 1.35;
      margin-top: 8px;
    }
    section {
      border-top: 1px solid var(--line);
      margin-top: 22px;
      padding-top: 18px;
    }
    section h2 {
      margin: 0 0 10px;
    }
    p, li {
      color: var(--ink);
      font-size: 14px;
      line-height: 1.6;
    }
    ul {
      margin: 0;
      padding-left: 18px;
    }
    .footer-note {
      margin-top: 28px;
      padding: 16px 18px;
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 18px;
      background: #fff7e8;
      color: #6b4b14;
      font-size: 13px;
      line-height: 1.55;
    }
    @media print {
      body { background: #ffffff; }
      .page { padding: 18mm 16mm 20mm; }
      .hero, .metric, .card { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <div class="kicker">${escapeHtml(kicker)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </header>
    ${body}
  </div>
  <script>window.print()</script>
</body>
</html>`);
  win.document.close();
}

function metricStrip(items: Array<[string, string]>) {
  return `<section class="metric-strip">${items
    .map(
      ([label, value]) =>
        `<article class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></article>`,
    )
    .join("")}</section>`;
}

function splitSection(title: string, cards: string[]) {
  return `<section><h2>${escapeHtml(title)}</h2><div class="split-grid">${cards.join("")}</div></section>`;
}

function cardBlock(title: string, items: string[]) {
  return `<article class="card"><span>${escapeHtml(title)}</span>${items
    .filter(Boolean)
    .map((item) => `<b>${escapeHtml(item)}</b>`)
    .join("")}</article>`;
}

function proseSection(title: string, value: string) {
  return section(title, [value]);
}

function listSection(title: string, items: string[]) {
  return section(title, items);
}

function footerBlock(value: string) {
  return `<div class="footer-note">${escapeHtml(value)}</div>`;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
