import type { Exercise, Scene } from "@/data";
import { buildBoardFilename } from "./filename";
import type { BoardScene, TacticalBoard } from "./boardModel";
import { renderTacticalBoardSvgMarkup, type TacticalBoardSvgOptions } from "./renderBoardSvg";

export type BoardBriefingOptions = TacticalBoardSvgOptions & {
  title: string;
  subtitle?: string;
  coachingPoints?: string[];
  staffNotes?: string[];
  date?: string | Date;
};

export function buildBoardSvgExport({
  scene,
  title,
  date,
  ...options
}: TacticalBoardSvgOptions & {
  scene: Scene;
  title: string;
  date?: string | Date;
}) {
  return {
    filename: buildBoardFilename({ title, date, extension: "svg" }),
    mimeType: "image/svg+xml;charset=utf-8",
    content: renderTacticalBoardSvgMarkup(scene, { ...options, title }),
  };
}

export function buildExerciseBoardSvgExport(
  exercise: Exercise,
  options: TacticalBoardSvgOptions & { date?: string | Date } = {},
) {
  return buildBoardSvgExport({
    scene: exercise.scene,
    title: options.title ?? exercise.title,
    date: options.date,
    ...options,
  });
}

export function buildBoardBriefingHtml({
  scene,
  title,
  subtitle = "Briefing tactico para plantel y staff",
  coachingPoints = [],
  staffNotes = [],
  date,
  ...options
}: BoardBriefingOptions & { scene: Scene }): string {
  const filename = buildBoardFilename({
    title,
    date,
    prefix: "romboiq-board-briefing",
    extension: "html",
  });
  const svg = renderTacticalBoardSvgMarkup(scene, { ...options, title });

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(filename)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #102016;
      --muted: #52665a;
      --line: #d5dfd8;
      --panel: #f5f8f5;
      --accent: #0f8a43;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: #f7faf8;
    }
    .page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 32px 36px 44px;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .kicker {
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 8px 0 6px;
      font-size: 30px;
      line-height: 1.08;
    }
    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }
    .board {
      border: 1px solid var(--line);
      background: #071019;
      padding: 14px;
      margin: 20px 0;
    }
    .board svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    section {
      border: 1px solid var(--line);
      background: #ffffff;
      padding: 16px 18px;
    }
    h2 {
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      margin: 0 0 10px;
      text-transform: uppercase;
    }
    ul {
      margin: 0;
      padding-left: 18px;
    }
    li {
      font-size: 14px;
      line-height: 1.55;
      margin: 4px 0;
    }
    @media print {
      body { background: #ffffff; }
      .page { padding: 14mm; }
      .board, section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="kicker">${escapeHtml(filename)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </header>
    <div class="board">${svg}</div>
    <div class="grid">
      ${briefingSection("Puntos de coaching", coachingPoints)}
      ${briefingSection("Notas staff", staffNotes)}
    </div>
  </main>
</body>
</html>`;
}

export function buildExerciseBoardBriefingHtml(
  exercise: Exercise,
  options: Omit<BoardBriefingOptions, "title"> & { title?: string } = {},
): string {
  return buildBoardBriefingHtml({
    scene: exercise.scene,
    title: options.title ?? exercise.title,
    subtitle: options.subtitle ?? exercise.objective.primary,
    coachingPoints: options.coachingPoints ?? exercise.coaching,
    staffNotes: options.staffNotes ?? [
      exercise.organization,
      ...exercise.rules.slice(0, 3),
    ],
    ...options,
  });
}

export type TacticalBoardBriefAudience = "player" | "staff";

export function buildTacticalBoardBriefingExport(
  board: TacticalBoard,
  audience: TacticalBoardBriefAudience,
  date: string | Date = new Date(),
) {
  const isPlayer = audience === "player";
  const segment = isPlayer ? "jugadores" : "staff";
  const filename = buildBoardFilename({
    title: `${board.title}-${segment}`,
    date,
    extension: "html",
  });
  const title = isPlayer ? "Briefing imprimible jugadores" : "Briefing imprimible staff";
  const scenes = board.scenes.slice(0, isPlayer ? 2 : board.scenes.length);
  const body = scenes.map((scene) => buildTacticalBoardBriefScene(board, scene, isPlayer)).join("");
  const linkedFocus = board.linkedWeeklyFocusId
    ? `<p><strong>Foco semanal:</strong> ${escapeHtml(board.linkedWeeklyFocusId)}</p>`
    : "";
  const opponent = !isPlayer
    ? `<p><strong>Rival:</strong> ${escapeHtml(board.opponent.formation)} / bloque ${escapeHtml(board.opponent.block)} / fuerte ${escapeHtml(board.opponent.strongSide)} / debil ${escapeHtml(board.opponent.weakSide)}</p>`
    : "";

  return {
    filename,
    mimeType: "text/html;charset=utf-8",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title><style>${briefCss()}</style></head><body><main><header><p>${escapeHtml(filename)}</p><h1>${title}: ${escapeHtml(board.title)}</h1>${board.globalInstruction ? `<h3>${escapeHtml(board.globalInstruction)}</h3>` : ""}${linkedFocus}${opponent}</header>${body}</main><script>window.print()</script></body></html>`,
  };
}

function buildTacticalBoardBriefScene(board: TacticalBoard, scene: BoardScene, playerOnly: boolean) {
  const instructions = [...board.instructions, ...scene.instructions]
    .filter((instruction) => !playerOnly || instruction.visibility === "player" || instruction.visibility === "export")
    .slice(0, playerOnly ? 4 : 10);
  const sceneNotes = !playerOnly && scene.notes.trim()
    ? `<p class="staff-note">${escapeHtml(scene.notes.trim())}</p>`
    : "";
  const coachingPoints = !playerOnly && board.sessionCoachingPoints.length
    ? `<h3>Puntos de coaching</h3><ul>${board.sessionCoachingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
    : "";
  const successSignals = board.successSignals.length
    ? `<h3>Senales de exito</h3><ul>${board.successSignals.map((signal) => `<li>${escapeHtml(signal)}</li>`).join("")}</ul>`
    : "";

  return `
    <section>
      <h2>${escapeHtml(scene.title)} · ${escapeHtml(scene.phaseLabel)}</h2>
      <div class="brief-board">${tacticalBoardSceneSvgString(scene, playerOnly)}</div>
      ${sceneNotes}
      <ul>
        ${instructions
          .map((instruction) => `<li><strong>${escapeHtml(instruction.title)}:</strong> ${escapeHtml(instruction.text)}</li>`)
          .join("")}
      </ul>
      ${coachingPoints}
      ${successSignals}
    </section>
  `;
}

export function tacticalBoardSceneSvgString(scene: BoardScene, playerOnly: boolean) {
  const objects = scene.objects.filter((object) =>
    !playerOnly || object.visibility === "player" || object.visibility === "export" || object.type === "ball",
  );
  const arrows = scene.arrows.filter((arrow) =>
    !playerOnly || arrow.visibility === "player" || arrow.visibility === "export",
  );
  const zones = scene.zones.filter((zone) =>
    !playerOnly || zone.visibility === "player" || zone.visibility === "export",
  );
  return `<svg viewBox="0 0 100 64" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="64" fill="#082015"/><g fill="none" stroke="rgba(232,255,247,.45)" stroke-width=".35"><rect x="2" y="2" width="96" height="60"/><line x1="50" y1="2" x2="50" y2="62"/><circle cx="50" cy="32" r="7.5"/></g>${zones.map((z) => `<rect x="${z.x}" y="${toSvgY(z.y)}" width="${z.w}" height="${(z.h / 100) * 64}" fill="${z.color}22" stroke="${z.color}"/>`).join("")}${arrows.map((a) => { const f = resolveBoardScenePoint(a.from, scene); const t = resolveBoardScenePoint(a.to, scene); return f && t ? `<line x1="${f.x}" y1="${toSvgY(f.y)}" x2="${t.x}" y2="${toSvgY(t.y)}" stroke="${a.semantic === "pressure" ? "#ff7474" : "#5eead4"}" stroke-width=".8"/>` : ""; }).join("")}${objects.map((o) => `<circle cx="${o.position.x}" cy="${toSvgY(o.position.y)}" r="${o.type === "ball" ? 1.4 : 2.8}" fill="${o.type === "opponentToken" ? "#ff7474" : o.type === "ball" ? "#fff" : "#5eead4"}"/>`).join("")}</svg>`;
}

function briefingSection(title: string, items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  return `<section><h2>${escapeHtml(title)}</h2>${
    clean.length
      ? `<ul>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "<p>Sin datos.</p>"
  }</section>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function briefCss() {
  return "body{margin:0;background:#f7faf8;color:#102016;font-family:Inter,Segoe UI,Arial,sans-serif}main{max-width:980px;margin:0 auto;padding:34px}header{border-bottom:1px solid #d5dfd8;margin-bottom:20px}h1{margin:6px 0 10px}h2{font-size:18px}h3{font-size:14px;margin:12px 0 6px}.staff-note{background:#f1f5f1;border-left:3px solid #6b806f;padding:10px 12px}section{break-inside:avoid;border:1px solid #d5dfd8;background:white;margin:18px 0;padding:16px}.brief-board{background:#071019;padding:12px}.brief-board svg{width:100%;height:auto}li{line-height:1.55;margin:5px 0}@media print{body{background:white}main{padding:14mm}}";
}

function toSvgY(value: number) {
  return (value / 100) * 64;
}

function resolveBoardScenePoint(
  endpoint: BoardScene["arrows"][number]["from"],
  scene: BoardScene,
) {
  if (endpoint.kind === "point") return endpoint.point;
  return scene.objects.find((object) => object.id === endpoint.objectId)?.position ?? null;
}
