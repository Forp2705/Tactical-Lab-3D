import type { Sketch, SketchTeam } from "./sketchSchemas";
import {
  SKETCH_VIEWBOX_HEIGHT,
  SKETCH_VIEWBOX_WIDTH,
  toSvgX,
  toSvgY,
} from "./sketchGeometry";

const TEAM_COLOR: Record<SketchTeam, string> = {
  home: "#5eead4",
  away: "#60a5fa",
  neutral: "#6f8790",
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSketchSvgMarkup(sketch: Sketch) {
  const annotations = sketch.annotations
    .map((annotation) => {
      if (annotation.type === "zone") {
        const x = toSvgX(annotation.x);
        const y = toSvgY(annotation.y);
        const w = toSvgX(annotation.w);
        const h = toSvgY(annotation.h);
        if (annotation.shape === "circle") {
          return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${Math.max(
            w / 2,
            0.5,
          )}" ry="${Math.max(
            h / 2,
            0.5,
          )}" fill="rgba(199,223,95,0.1)" stroke="#c7df5f" stroke-width="0.5" />`;
        }
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(199,223,95,0.1)" stroke="#c7df5f" stroke-width="0.5" />`;
      }

      const x1 = toSvgX(annotation.from.x);
      const y1 = toSvgY(annotation.from.y);
      const x2 = toSvgX(annotation.to.x);
      const y2 = toSvgY(annotation.to.y);
      const lineStyle =
        annotation.type === "arrow"
          ? `stroke="#60a5fa" stroke-width="0.6" marker-end="url(#briefing-arrowhead)"`
          : `stroke="#60a5fa" stroke-width="0.6" stroke-dasharray="2 1.4"`;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${lineStyle} />`;
    })
    .join("");

  const labels = sketch.labels
    .map(
      (label) =>
        `<text x="${toSvgX(label.x)}" y="${toSvgY(label.y)}" font-size="3" fill="#eff7fa">${escapeXml(
          label.text,
        )}</text>`,
    )
    .join("");

  const tokens = sketch.tokens
    .map(
      (token) =>
        `<circle cx="${toSvgX(token.x)}" cy="${toSvgY(token.y)}" r="1.8" fill="${
          TEAM_COLOR[token.team]
        }" stroke="rgba(5,11,16,0.7)" stroke-width="0.4" />`,
    )
    .join("");

  return `
<svg viewBox="0 0 ${SKETCH_VIEWBOX_WIDTH} ${SKETCH_VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(
    `Boceto: ${sketch.title}`,
  )}">
  <rect x="0.5" y="0.5" width="${SKETCH_VIEWBOX_WIDTH - 1}" height="${
    SKETCH_VIEWBOX_HEIGHT - 1
  }" rx="2" fill="rgba(94,234,212,0.03)" stroke="rgba(102,180,183,0.35)" stroke-width="0.4" />
  <line x1="${SKETCH_VIEWBOX_WIDTH / 2}" y1="1" x2="${
    SKETCH_VIEWBOX_WIDTH / 2
  }" y2="${SKETCH_VIEWBOX_HEIGHT - 1}" stroke="rgba(102,180,183,0.35)" stroke-width="0.3" />
  <circle cx="${SKETCH_VIEWBOX_WIDTH / 2}" cy="${
    SKETCH_VIEWBOX_HEIGHT / 2
  }" r="6" fill="none" stroke="rgba(102,180,183,0.35)" stroke-width="0.3" />
  ${annotations}
  ${labels}
  ${tokens}
  <defs>
    <marker id="briefing-arrowhead" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#60a5fa" />
    </marker>
  </defs>
</svg>`.trim();
}
