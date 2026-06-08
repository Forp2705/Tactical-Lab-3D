import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createSketchItemId,
  type Sketch,
  type SketchAnnotation,
  type SketchPoint,
  type SketchTeam,
  type SketchTextLabel,
  type SketchToken,
  type SketchTool,
} from "./sketchSchemas";
import {
  SKETCH_VIEWBOX_HEIGHT,
  SKETCH_VIEWBOX_WIDTH,
  distanceToSegment,
  isMeaningfulDrag,
  isPointInCircle,
  isPointInRect,
  isPointOverToken,
  normalizeRect,
  pixelToPercent,
  toSvgX,
  toSvgY,
} from "./sketchGeometry";

/**
 * Quick Sketch — minimal flat 2D pitch editor.
 *
 * Deliberately small tool palette (select, player, arrow, line, zone, text,
 * delete). No undo/redo, no multi-select, no layers, no animation — see
 * PRODUCT.md "Quick Sketch" spec for the full rationale and boundaries.
 *
 * Pure SVG, no Three.js / React Three Fiber. Coordinates are normalized to
 * 0-100 on both axes and rendered against a `100 x 64` viewBox so on-screen
 * pixels map linearly to stored percentages (see sketchGeometry.ts).
 */

const TOOLS: { id: SketchTool; label: string; hint: string }[] = [
  { id: "select", label: "Seleccionar", hint: "Tocar para elegir, arrastrar para mover" },
  { id: "player", label: "Jugador", hint: "Tocar la cancha para colocar un token" },
  { id: "arrow", label: "Flecha", hint: "Arrastrar para dibujar una flecha" },
  { id: "line", label: "Linea", hint: "Arrastrar para dibujar una linea" },
  { id: "zone", label: "Zona", hint: "Arrastrar para marcar una zona" },
  { id: "text", label: "Texto", hint: "Tocar para anclar un texto corto" },
  { id: "delete", label: "Eliminar", hint: "Tocar un elemento para borrarlo" },
];

const TEAM_OPTIONS: { id: SketchTeam; label: string }[] = [
  { id: "home", label: "Propio" },
  { id: "away", label: "Rival" },
  { id: "neutral", label: "Neutral" },
];

const TEAM_COLOR: Record<SketchTeam, string> = {
  home: "var(--accent)",
  away: "var(--accent-2)",
  neutral: "var(--muted-2)",
};

type Selection =
  | { kind: "token"; id: string }
  | { kind: "annotation"; id: string }
  | { kind: "label"; id: string }
  | null;

type DrawDraft = { tool: "arrow" | "line" | "zone"; start: SketchPoint; current: SketchPoint } | null;

type MoveDraft = { selection: Exclude<Selection, null>; offset: SketchPoint } | null;

type TextDraft = { id: string; x: number; y: number; value: string; isNew: boolean } | null;

export type QuickSketchViewProps = {
  /** The sketch being edited. Caller owns creation (e.g. `createBlankSketch`). */
  sketch: Sketch;
  /** Called with the updated sketch when the coach saves. */
  onSave: (sketch: Sketch) => void;
  /** Called when the coach discards changes and closes the editor. */
  onCancel?: () => void;
};

function nextTokenLabel(tokens: SketchToken[]): string {
  return String(tokens.length + 1);
}

function slugifySketchTitle(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "boceto"
  );
}

function findHitItem(point: SketchPoint, sketch: Sketch): Selection {
  for (let i = sketch.tokens.length - 1; i >= 0; i -= 1) {
    const token = sketch.tokens[i];
    if (isPointOverToken(point, token)) return { kind: "token", id: token.id };
  }
  for (let i = sketch.labels.length - 1; i >= 0; i -= 1) {
    const label = sketch.labels[i];
    if (isPointOverToken(point, label, 4)) return { kind: "label", id: label.id };
  }
  for (let i = sketch.annotations.length - 1; i >= 0; i -= 1) {
    const annotation = sketch.annotations[i];
    if (annotation.type === "zone") {
      const rect = { x: annotation.x, y: annotation.y, w: annotation.w, h: annotation.h };
      const inside = annotation.shape === "circle" ? isPointInCircle(point, rect) : isPointInRect(point, rect);
      if (inside) return { kind: "annotation", id: annotation.id };
    } else if (distanceToSegment(point, annotation.from, annotation.to) <= 2) {
      return { kind: "annotation", id: annotation.id };
    }
  }
  return null;
}

export function QuickSketchView({ sketch, onSave, onCancel }: QuickSketchViewProps) {
  const [draft, setDraft] = useState<Sketch>(sketch);
  const [tool, setTool] = useState<SketchTool>("select");
  const [activeTeam, setActiveTeam] = useState<SketchTeam>("home");
  const [selection, setSelection] = useState<Selection>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft>(null);
  const [moveDraft, setMoveDraft] = useState<MoveDraft>(null);
  const [textDraft, setTextDraft] = useState<TextDraft>(null);
  const [exportStatus, setExportStatus] = useState<"idle" | "working" | "error">("idle");
  const surfaceRef = useRef<SVGSVGElement | null>(null);

  const activeToolMeta = useMemo(() => TOOLS.find((entry) => entry.id === tool) ?? TOOLS[0], [tool]);

  const pointFromEvent = useCallback((event: ReactPointerEvent<SVGSVGElement>): SketchPoint | null => {
    const node = surfaceRef.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return pixelToPercent(event.clientX, event.clientY, rect);
  }, []);

  const commitTextDraft = useCallback((nextValue?: string) => {
    setTextDraft((current) => {
      if (!current) return null;
      const value = (nextValue ?? current.value).trim();
      if (!value) {
        if (!current.isNew) return null;
        return null;
      }
      setDraft((prev) => {
        const exists = prev.labels.some((label) => label.id === current.id);
        const labels: SketchTextLabel[] = exists
          ? prev.labels.map((label) => (label.id === current.id ? { ...label, text: value } : label))
          : [...prev.labels, { id: current.id, x: current.x, y: current.y, text: value }];
        return { ...prev, labels, updatedAt: new Date().toISOString() };
      });
      return null;
    });
  }, []);

  const removeItem = useCallback((target: Exclude<Selection, null>) => {
    setDraft((prev) => {
      if (target.kind === "token") {
        return { ...prev, tokens: prev.tokens.filter((token) => token.id !== target.id), updatedAt: new Date().toISOString() };
      }
      if (target.kind === "label") {
        return { ...prev, labels: prev.labels.filter((label) => label.id !== target.id), updatedAt: new Date().toISOString() };
      }
      return {
        ...prev,
        annotations: prev.annotations.filter((annotation) => annotation.id !== target.id),
        updatedAt: new Date().toISOString(),
      };
    });
    setSelection((current) => (current && current.kind === target.kind && current.id === target.id ? null : current));
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const point = pointFromEvent(event);
      if (!point) return;
      if (textDraft) commitTextDraft();

      if (tool === "select") {
        const hit = findHitItem(point, draft);
        setSelection(hit);
        if (hit) {
          let anchor: SketchPoint = point;
          if (hit.kind === "token") {
            const token = draft.tokens.find((entry) => entry.id === hit.id);
            if (token) anchor = token;
          } else if (hit.kind === "label") {
            const label = draft.labels.find((entry) => entry.id === hit.id);
            if (label) anchor = label;
          } else {
            const annotation = draft.annotations.find((entry) => entry.id === hit.id);
            if (annotation) anchor = annotation.type === "zone" ? { x: annotation.x, y: annotation.y } : annotation.from;
          }
          setMoveDraft({ selection: hit, offset: { x: point.x - anchor.x, y: point.y - anchor.y } });
          surfaceRef.current?.setPointerCapture(event.pointerId);
        }
        return;
      }

      if (tool === "player") {
        const id = createSketchItemId("token");
        const token: SketchToken = { id, x: point.x, y: point.y, label: nextTokenLabel(draft.tokens), team: activeTeam };
        setDraft((prev) => ({ ...prev, tokens: [...prev.tokens, token], updatedAt: new Date().toISOString() }));
        setSelection({ kind: "token", id });
        return;
      }

      if (tool === "text") {
        const id = createSketchItemId("label");
        setSelection({ kind: "label", id });
        setTextDraft({ id, x: point.x, y: point.y, value: "", isNew: true });
        return;
      }

      if (tool === "delete") {
        const hit = findHitItem(point, draft);
        if (hit) removeItem(hit);
        return;
      }

      if (tool === "arrow" || tool === "line" || tool === "zone") {
        setDrawDraft({ tool, start: point, current: point });
        surfaceRef.current?.setPointerCapture(event.pointerId);
      }
    },
    [activeTeam, commitTextDraft, draft, pointFromEvent, removeItem, textDraft, tool],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const point = pointFromEvent(event);
      if (!point) return;

      if (drawDraft) {
        setDrawDraft({ ...drawDraft, current: point });
        return;
      }

      if (moveDraft) {
        const target: SketchPoint = { x: point.x - moveDraft.offset.x, y: point.y - moveDraft.offset.y };
        const sel = moveDraft.selection;
        setDraft((prev) => {
          if (sel.kind === "token") {
            return {
              ...prev,
              tokens: prev.tokens.map((token) => (token.id === sel.id ? { ...token, x: target.x, y: target.y } : token)),
            };
          }
          if (sel.kind === "label") {
            return {
              ...prev,
              labels: prev.labels.map((label) => (label.id === sel.id ? { ...label, x: target.x, y: target.y } : label)),
            };
          }
          return {
            ...prev,
            annotations: prev.annotations.map((annotation) => {
              if (annotation.id !== sel.id) return annotation;
              if (annotation.type === "zone") {
                return { ...annotation, x: target.x, y: target.y };
              }
              const dx = target.x - annotation.from.x;
              const dy = target.y - annotation.from.y;
              return {
                ...annotation,
                from: target,
                to: { x: annotation.to.x + dx, y: annotation.to.y + dy },
              };
            }),
          };
        });
      }
    },
    [drawDraft, moveDraft, pointFromEvent],
  );

  const finishDraw = useCallback(() => {
    if (!drawDraft) return;
    const { tool: drawTool, start, current } = drawDraft;
    setDrawDraft(null);
    if (!isMeaningfulDrag(start, current)) return;

    if (drawTool === "zone") {
      const rect = normalizeRect(start, current);
      if (rect.w < 1 || rect.h < 1) return;
      const id = createSketchItemId("zone");
      const annotation: SketchAnnotation = { id, type: "zone", shape: "rectangle", ...rect };
      setDraft((prev) => ({ ...prev, annotations: [...prev.annotations, annotation], updatedAt: new Date().toISOString() }));
      setSelection({ kind: "annotation", id });
      return;
    }

    const id = createSketchItemId(drawTool);
    const annotation: SketchAnnotation = { id, type: drawTool, from: start, to: current };
    setDraft((prev) => ({ ...prev, annotations: [...prev.annotations, annotation], updatedAt: new Date().toISOString() }));
    setSelection({ kind: "annotation", id });
  }, [drawDraft]);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (drawDraft) finishDraw();
      if (moveDraft) {
        setDraft((prev) => ({ ...prev, updatedAt: new Date().toISOString() }));
        setMoveDraft(null);
      }
      if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
        surfaceRef.current.releasePointerCapture(event.pointerId);
      }
    },
    [drawDraft, finishDraw, moveDraft],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if ((event.key === "Delete" || event.key === "Backspace") && selection && !textDraft) {
        const target = event.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        event.preventDefault();
        removeItem(selection);
      }
    },
    [removeItem, selection, textDraft],
  );

  const handleExportImage = useCallback(async () => {
    const surface = surfaceRef.current;
    if (!surface || exportStatus === "working") return;
    setExportStatus("working");
    try {
      const { exportSvgImage } = await import("@/export/media");
      const today = new Date().toISOString().slice(0, 10);
      const filename = `romboiq-sketch-${slugifySketchTitle(draft.title)}-${today}.png`;
      await exportSvgImage(surface, filename, { background: "#050b10" });
      setExportStatus("idle");
    } catch {
      setExportStatus("error");
    }
  }, [draft.title, exportStatus]);

  const textOverlayStyle = useMemo(() => {
    if (!textDraft) return null;
    return {
      left: `${textDraft.x}%`,
      top: `${textDraft.y}%`,
    };
  }, [textDraft]);

  const selectedAnnotation =
    selection?.kind === "annotation" ? draft.annotations.find((entry) => entry.id === selection.id) ?? null : null;
  const selectedToken = selection?.kind === "token" ? draft.tokens.find((entry) => entry.id === selection.id) ?? null : null;
  const selectedLabel = selection?.kind === "label" ? draft.labels.find((entry) => entry.id === selection.id) ?? null : null;

  const drawPreview = useMemo(() => {
    if (!drawDraft) return null;
    if (drawDraft.tool === "zone") {
      const rect = normalizeRect(drawDraft.start, drawDraft.current);
      return (
        <rect
          x={toSvgX(rect.x)}
          y={toSvgY(rect.y)}
          width={toSvgX(rect.w)}
          height={toSvgY(rect.h)}
          className="sketch-annotation-zone sketch-annotation-preview"
        />
      );
    }
    return (
      <line
        x1={toSvgX(drawDraft.start.x)}
        y1={toSvgY(drawDraft.start.y)}
        x2={toSvgX(drawDraft.current.x)}
        y2={toSvgY(drawDraft.current.y)}
        className={`sketch-annotation-${drawDraft.tool} sketch-annotation-preview`}
        markerEnd={drawDraft.tool === "arrow" ? "url(#sketch-arrowhead-preview)" : undefined}
      />
    );
  }, [drawDraft]);

  return (
    <div className="quick-sketch" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="quick-sketch-toolbar">
        <input
          className="quick-sketch-title-input"
          value={draft.title}
          maxLength={80}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          aria-label="Nombre del boceto"
          placeholder="Nombre del boceto"
        />
        <div className="quick-sketch-tools" role="toolbar" aria-label="Herramientas del boceto">
          {TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`quick-sketch-tool ${tool === entry.id ? "active" : ""}`.trim()}
              onClick={() => {
                setTool(entry.id);
                setSelection(null);
                if (textDraft) commitTextDraft();
              }}
              title={entry.hint}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {tool === "player" && (
          <div className="quick-sketch-team-picker" role="radiogroup" aria-label="Equipo del proximo token">
            {TEAM_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={activeTeam === option.id}
                className={`quick-sketch-team-chip ${activeTeam === option.id ? "active" : ""}`.trim()}
                style={{ "--team-color": TEAM_COLOR[option.id] } as CSSProperties}
                onClick={() => setActiveTeam(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="quick-sketch-hint">{activeToolMeta.hint}</p>

      <div className="quick-sketch-surface-wrap">
        <svg
          ref={surfaceRef}
          className="quick-sketch-surface"
          viewBox={`0 0 ${SKETCH_VIEWBOX_WIDTH} ${SKETCH_VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="img"
          aria-label={`Cancha del boceto ${draft.title}`}
        >
          <defs>
            <marker id="sketch-arrowhead" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="sketch-arrowhead" />
            </marker>
            <marker id="sketch-arrowhead-preview" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="sketch-arrowhead-preview" />
            </marker>
          </defs>

          <rect x={0.4} y={0.4} width={SKETCH_VIEWBOX_WIDTH - 0.8} height={SKETCH_VIEWBOX_HEIGHT - 0.8} className="quick-sketch-pitch" />
          <line
            x1={SKETCH_VIEWBOX_WIDTH / 2}
            y1={0.4}
            x2={SKETCH_VIEWBOX_WIDTH / 2}
            y2={SKETCH_VIEWBOX_HEIGHT - 0.4}
            className="quick-sketch-pitch-mark"
          />
          <circle cx={SKETCH_VIEWBOX_WIDTH / 2} cy={SKETCH_VIEWBOX_HEIGHT / 2} r={7} className="quick-sketch-pitch-mark" fill="none" />
          <rect x={0.4} y={SKETCH_VIEWBOX_HEIGHT / 2 - 12} width={14} height={24} className="quick-sketch-pitch-mark" fill="none" />
          <rect
            x={SKETCH_VIEWBOX_WIDTH - 14.4}
            y={SKETCH_VIEWBOX_HEIGHT / 2 - 12}
            width={14}
            height={24}
            className="quick-sketch-pitch-mark"
            fill="none"
          />

          {draft.annotations.map((annotation) => {
            const isSelected = selection?.kind === "annotation" && selection.id === annotation.id;
            if (annotation.type === "zone") {
              const x = toSvgX(annotation.x);
              const y = toSvgY(annotation.y);
              const w = toSvgX(annotation.w);
              const h = toSvgY(annotation.h);
              const zoneClassName = `sketch-annotation-zone ${isSelected ? "selected" : ""}`.trim();
              if (annotation.shape === "circle") {
                return (
                  <ellipse
                    key={annotation.id}
                    cx={x + w / 2}
                    cy={y + h / 2}
                    rx={Math.max(w / 2, 0.5)}
                    ry={Math.max(h / 2, 0.5)}
                    className={zoneClassName}
                  />
                );
              }
              return <rect key={annotation.id} x={x} y={y} width={w} height={h} className={zoneClassName} />;
            }
            return (
              <line
                key={annotation.id}
                x1={toSvgX(annotation.from.x)}
                y1={toSvgY(annotation.from.y)}
                x2={toSvgX(annotation.to.x)}
                y2={toSvgY(annotation.to.y)}
                className={`sketch-annotation-${annotation.type} ${isSelected ? "selected" : ""}`.trim()}
                markerEnd={annotation.type === "arrow" ? "url(#sketch-arrowhead)" : undefined}
              />
            );
          })}

          {drawPreview}

          {draft.labels.map((label) => {
            if (textDraft && textDraft.id === label.id) return null;
            const isSelected = selection?.kind === "label" && selection.id === label.id;
            return (
              <text
                key={label.id}
                x={toSvgX(label.x)}
                y={toSvgY(label.y)}
                className={`quick-sketch-label ${isSelected ? "selected" : ""}`.trim()}
              >
                {label.text}
              </text>
            );
          })}

          {draft.tokens.map((token) => {
            const isSelected = selection?.kind === "token" && selection.id === token.id;
            return (
              <g key={token.id} className={`quick-sketch-token ${isSelected ? "selected" : ""}`.trim()}>
                <circle cx={toSvgX(token.x)} cy={toSvgY(token.y)} r={2.6} fill={TEAM_COLOR[token.team]} />
                <text x={toSvgX(token.x)} y={toSvgY(token.y)} className="quick-sketch-token-label">
                  {token.label}
                </text>
              </g>
            );
          })}
        </svg>

        {textDraft && textOverlayStyle && (
          <input
            autoFocus
            className="quick-sketch-text-input"
            style={textOverlayStyle}
            value={textDraft.value}
            maxLength={80}
            placeholder="Texto corto..."
            onChange={(event) => setTextDraft((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
            onBlur={() => commitTextDraft()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTextDraft();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setTextDraft(null);
                setSelection(null);
              }
            }}
          />
        )}
      </div>

      <div className="quick-sketch-status-row">
        <span className="quick-sketch-status">
          {selectedToken && `Token "${selectedToken.label}" seleccionado`}
          {selectedLabel && `Texto "${selectedLabel.text}" seleccionado`}
          {selectedAnnotation && `Anotacion (${selectedAnnotation.type}) seleccionada`}
          {!selection && "Nada seleccionado"}
        </span>
        <button
          type="button"
          className="quick-sketch-delete-selected"
          disabled={!selection}
          onClick={() => selection && removeItem(selection)}
        >
          Eliminar seleccionado
        </button>
      </div>

      <div className="quick-sketch-actions">
        {onCancel && (
          <button type="button" className="quick-sketch-cancel" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="quick-sketch-export"
          onClick={handleExportImage}
          disabled={exportStatus === "working"}
        >
          {exportStatus === "working" ? "Exportando..." : "Exportar boceto"}
        </button>
        {exportStatus === "error" && (
          <span className="quick-sketch-export-error">
            No se pudo exportar la imagen. Intenta de nuevo.
          </span>
        )}
        <button
          type="button"
          className="quick-sketch-save"
          onClick={() => {
            if (textDraft) commitTextDraft();
            const finalTitle = draft.title.trim().length ? draft.title.trim() : "Boceto sin titulo";
            onSave({ ...draft, title: finalTitle, updatedAt: new Date().toISOString() });
          }}
        >
          Guardar boceto
        </button>
      </div>
    </div>
  );
}
