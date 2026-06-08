import type { Sketch, SketchTeam } from "./sketchSchemas";
import { SKETCH_VIEWBOX_HEIGHT, SKETCH_VIEWBOX_WIDTH, toSvgX, toSvgY } from "./sketchGeometry";

/**
 * Lightweight, read-only SVG preview of a sketch. Used inside session block
 * cards and anywhere else a coach needs to recognize a sketch at a glance —
 * intentionally not interactive (no pointer handlers, no editing affordances).
 */

const TEAM_COLOR: Record<SketchTeam, string> = {
  home: "var(--accent)",
  away: "var(--accent-2)",
  neutral: "var(--muted-2)",
};

type SketchThumbnailProps = {
  sketch: Sketch | null | undefined;
  className?: string;
  title?: string;
};

export function SketchThumbnail({ sketch, className, title }: SketchThumbnailProps) {
  if (!sketch) {
    return (
      <div className={`sketch-thumb sketch-thumb-empty ${className ?? ""}`.trim()}>
        <span>Sin boceto</span>
      </div>
    );
  }

  return (
    <svg
      className={`sketch-thumb ${className ?? ""}`.trim()}
      viewBox={`0 0 ${SKETCH_VIEWBOX_WIDTH} ${SKETCH_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title ?? `Boceto: ${sketch.title}`}
    >
      <rect
        x={0.5}
        y={0.5}
        width={SKETCH_VIEWBOX_WIDTH - 1}
        height={SKETCH_VIEWBOX_HEIGHT - 1}
        rx={2}
        className="sketch-thumb-pitch"
      />
      <line
        x1={SKETCH_VIEWBOX_WIDTH / 2}
        y1={1}
        x2={SKETCH_VIEWBOX_WIDTH / 2}
        y2={SKETCH_VIEWBOX_HEIGHT - 1}
        className="sketch-thumb-mark"
      />
      <circle
        cx={SKETCH_VIEWBOX_WIDTH / 2}
        cy={SKETCH_VIEWBOX_HEIGHT / 2}
        r={6}
        className="sketch-thumb-mark"
        fill="none"
      />

      {sketch.annotations.map((annotation) => {
        if (annotation.type === "zone") {
          const x = toSvgX(annotation.x);
          const y = toSvgY(annotation.y);
          const w = toSvgX(annotation.w);
          const h = toSvgY(annotation.h);
          if (annotation.shape === "circle") {
            return (
              <ellipse
                key={annotation.id}
                cx={x + w / 2}
                cy={y + h / 2}
                rx={Math.max(w / 2, 0.5)}
                ry={Math.max(h / 2, 0.5)}
                className="sketch-thumb-zone"
              />
            );
          }
          return <rect key={annotation.id} x={x} y={y} width={w} height={h} className="sketch-thumb-zone" />;
        }

        const x1 = toSvgX(annotation.from.x);
        const y1 = toSvgY(annotation.from.y);
        const x2 = toSvgX(annotation.to.x);
        const y2 = toSvgY(annotation.to.y);
        return (
          <line
            key={annotation.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={annotation.type === "arrow" ? "sketch-thumb-arrow" : "sketch-thumb-line"}
            markerEnd={annotation.type === "arrow" ? "url(#sketch-thumb-arrowhead)" : undefined}
          />
        );
      })}

      {sketch.labels.map((label) => (
        <text key={label.id} x={toSvgX(label.x)} y={toSvgY(label.y)} className="sketch-thumb-text">
          {label.text}
        </text>
      ))}

      {sketch.tokens.map((token) => (
        <circle
          key={token.id}
          cx={toSvgX(token.x)}
          cy={toSvgY(token.y)}
          r={1.8}
          fill={TEAM_COLOR[token.team]}
          className="sketch-thumb-token"
        />
      ))}

      <defs>
        <marker
          id="sketch-thumb-arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="4.5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" className="sketch-thumb-arrowhead" />
        </marker>
      </defs>
    </svg>
  );
}
