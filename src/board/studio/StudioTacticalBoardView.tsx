import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppStore } from "@/state/useAppStore";
import { useBoardActions } from "@/board/useBoardActions";
import { resolveActiveBoard, resolveActiveScene } from "@/board/boardViewModel";
import { TacticalBoardEmptyState } from "@/board/components/TacticalBoardEmptyState";
import { TacticalBoardGhostSceneState } from "@/board/components/TacticalBoardGhostSceneState";
import { TacticalBoardErrorBoundary } from "@/board/components/TacticalBoardErrorBoundary";
import { PITCH_H, PITCH_W, type BoardTool } from "@/board/boardConstants";
import { clamp, endpointPoint, scaleY } from "@/board/boardGeometry";
import { arrowStyle } from "@/board/boardActionStyle";
import { resolveArrowHintText } from "@/board/boardTools";
import type {
  BoardArrowEndpoint,
  BoardObject,
  BoardPoint,
  BoardScene,
  TacticalBoard,
} from "@/board/boardModel";
import {
  STUDIO_TOOL_GROUPS,
  studioButtonForTool,
  type StudioRailButton,
} from "./studioToolGroups";
import { StudioToolIcon } from "./StudioIcons";
import {
  buildFxTimeline,
  cameraZoomEnvelope,
  easeInOutQuad,
  focusObjectIds,
  focusPoint,
  fxPathD,
  fxPositionAt,
  partialFxPathD,
  prefersReducedMotion,
  sampleTrail,
  type FxSegment,
} from "./studioPlayFx";

/**
 * "El Estudio Táctico" (W27) — la vista Pizarra de producción validada por
 * el dueño en MOCKUP-NORTE.html ("buen mockup, me gusta", tras 4 rechazos de
 * sensación). Reemplaza a TacticalBoardView en la ruta de Pizarra; el
 * archivo viejo y sus subcomponentes quedan intactos (switch de vista en
 * App.tsx, región W27 comentada). Reusa el motor entero via useBoardActions
 * (gestos, playback, gramática, lecturas, undo/autosave) — solo cambia la
 * superficie.
 *
 * Ver el worker_done para el catálogo de diferencias deliberadas con el
 * mockup (gaps de "Nota"/"Pelota" escalados, paleta de arrow completa en vez
 * de los 2 colores del demo, selector de formación no presente en el mockup,
 * etc.)
 */

const OWN_MARKER_COLOR = "#f2c230";
const RIVAL_MARKER_COLOR = "#ff6b5e";

function resolveTargetIdFromEvent(event: ReactPointerEvent<SVGSVGElement>) {
  const el = (event.target as Element).closest("[data-object-id]");
  return el?.getAttribute("data-object-id") ?? undefined;
}

export function StudioTacticalBoardView() {
  const tacticalBoards = useAppStore((state) => state.tacticalBoards);
  const activeBoardId = useAppStore((state) => state.activeBoardId);
  const activeBoardSceneId = useAppStore((state) => state.activeBoardSceneId);
  const createTacticalBoard = useAppStore((state) => state.createTacticalBoard);
  const createTacticalBoardFromWeeklyFocus = useAppStore(
    (state) => state.createTacticalBoardFromWeeklyFocus,
  );
  const openTacticalBoard = useAppStore((state) => state.openTacticalBoard);

  const board = resolveActiveBoard(tacticalBoards, activeBoardId);
  const scene = resolveActiveScene(board, activeBoardSceneId);

  if (!board) {
    const requestedMissing = Boolean(
      activeBoardId && !tacticalBoards.some((item) => item.id === activeBoardId),
    );
    return (
      <TacticalBoardEmptyState
        requestedMissing={requestedMissing}
        onCreateFromWeeklyFocus={() => createTacticalBoardFromWeeklyFocus()}
        onCreateBlank={() => createTacticalBoard({ title: "Pizarra tactica" })}
      />
    );
  }

  if (!scene) {
    return (
      <TacticalBoardGhostSceneState
        onOpenFirstScene={() => openTacticalBoard(board.id, board.scenes[0]?.id)}
      />
    );
  }

  return (
    <TacticalBoardErrorBoundary>
      <StudioWorkspace board={board} scene={scene} />
    </TacticalBoardErrorBoundary>
  );
}

function StudioWorkspace({ board, scene }: { board: TacticalBoard; scene: BoardScene }) {
  const a = useBoardActions(board, scene);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [fxEnabled, setFxEnabled] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setFxEnabled(!mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const fxTimeline = useMemo(() => buildFxTimeline(scene), [scene]);
  const fxByArrowId = useMemo(
    () => new Map(fxTimeline.segments.map((segment) => [segment.arrowId, segment])),
    [fxTimeline],
  );

  // Remate (deck): frase de ayudante de campo al terminar la jugada SOLA
  // (nunca al pausar/scrubear a mano).
  const [finalePhrase, setFinalePhrase] = useState<{ text: string; key: number } | null>(null);
  const wasPlayingRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only reacts to isPlaying transitions (the natural-end edge), not every render where playbackTime/aiInterpretation happen to change
  useEffect(() => {
    const naturalEnd =
      wasPlayingRef.current &&
      !a.isPlaying &&
      a.playbackDuration > 0 &&
      a.playbackTime >= a.playbackDuration - 0.01;
    wasPlayingRef.current = a.isPlaying;
    if (!naturalEnd || !fxEnabled) return;
    const text = a.aiInterpretation.at(-1)?.text ?? a.tacticalReads[0]?.text ?? null;
    if (!text) return;
    setFinalePhrase({ text, key: Date.now() });
    const id = setTimeout(() => setFinalePhrase(null), 2600);
    return () => clearTimeout(id);
  }, [a.isPlaying]);

  const [eraseArmed, setEraseArmed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only reacts to a.selection changing (the "next real pick becomes the erase target" gesture) — deleteSelection/setTool identities are stable per render of useBoardActions
  useEffect(() => {
    if (eraseArmed && a.selection) {
      a.deleteSelection();
      setEraseArmed(false);
      a.setTool("move");
    }
  }, [a.selection]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Undo/redo (item 7: "cableados tal cual"): el mockup no muestra botones,
  // asi que se cablea por teclado (Ctrl+Z / Ctrl+Shift+Z) — no roba el
  // atajo mientras se esta escribiendo en un input/textarea (playname, notas).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (isTyping) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) a.redo();
      else a.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.undo, a.redo]);

  const resolvePoint = (clientX: number, clientY: number): BoardPoint => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: 50, y: 32 };
    const rect = svgEl.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * PITCH_W, 0, PITCH_W),
      y: clamp(((clientY - rect.top) / rect.height) * PITCH_H, 0, PITCH_H),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest("[data-board-target]")) return;
    a.onCanvasPointerDown(resolvePoint(event.clientX, event.clientY));
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) =>
    a.onCanvasPointerMove(resolvePoint(event.clientX, event.clientY));
  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) =>
    a.onCanvasPointerUp(resolvePoint(event.clientX, event.clientY), resolveTargetIdFromEvent(event));
  const handleTokenPointerDown = (event: ReactPointerEvent<SVGGElement>, objectId: string) => {
    event.stopPropagation();
    a.onCanvasPointerDown(resolvePoint(event.clientX, event.clientY), objectId);
  };

  // Efecto #2 (curvas): reemplaza la posicion lineal del motor SOLO mientras
  // el tramo curvo esta en vuelo — asentado (progress 0 o 1) coincide con el
  // punto del motor, cero diferencia.
  const fxPositions: Record<string, BoardPoint> = {};
  for (const segment of fxTimeline.segments) {
    if (!segment.curved) continue;
    if (a.playbackTime <= segment.start || a.playbackTime >= segment.end) continue;
    const point = fxPositionAt(segment, a.playbackTime);
    for (const objectId of segment.objectIds) fxPositions[objectId] = point;
  }
  const displayObjects: BoardObject[] = scene.objects.map((object) => {
    const overridePosition = fxPositions[object.id] ?? a.playbackPositions?.[object.id];
    return overridePosition ? { ...object, position: overridePosition } : object;
  });

  const inPlayback = fxEnabled && a.playbackDuration > 0 && (a.isPlaying || a.playbackTime > 0);
  const focusIds = inPlayback ? focusObjectIds(fxTimeline.segments, a.playbackTime) : [];
  const focusModelPoint = inPlayback
    ? focusPoint(fxTimeline.segments, a.playbackTime, { x: 50, y: 32 })
    : { x: 50, y: 32 };
  const holdForFinale =
    a.playbackDuration > 0 && a.playbackTime >= a.playbackDuration && finalePhrase !== null;
  const showFocusFx = inPlayback && (a.isPlaying || a.playbackTime < a.playbackDuration || holdForFinale);
  const zoomT = inPlayback ? cameraZoomEnvelope(a.playbackTime, a.playbackDuration) : 0;
  const zoomScale = 1 - zoomT * 0.16;
  const camW = PITCH_W * zoomScale;
  const camH = PITCH_H * zoomScale;
  const camX = clamp(focusModelPoint.x - camW / 2, 0, PITCH_W - camW);
  const camY = clamp(scaleY(focusModelPoint.y) - camH / 2, 0, PITCH_H - camH);
  const viewBoxAttr = zoomT > 0.001 ? `${camX} ${camY} ${camW} ${camH}` : `0 0 ${PITCH_W} ${PITCH_H}`;

  const activeSegmentFor = (objectId: string): FxSegment | undefined => {
    if (!inPlayback) return undefined;
    return fxTimeline.segments.find(
      (segment) =>
        segment.objectIds.includes(objectId) &&
        a.playbackTime >= segment.start &&
        a.playbackTime <= segment.end,
    );
  };

  const dockErase = () => {
    a.setTool("select");
    setEraseArmed(true);
  };

  const onRailButtonPress = (button: StudioRailButton) => {
    setEraseArmed(false);
    if (button.special === "erase") {
      dockErase();
      return;
    }
    if (button.tool) a.setTool(button.tool);
  };

  const isTrazoActive = (button: StudioRailButton) =>
    button.tool !== undefined && a.tool === button.tool && !eraseArmed;

  const hintText = resolveArrowHintText({
    grammarBlockReason: a.grammarBlockNotice?.reason ?? null,
    isArrowToolActive: Boolean(a.isArrowToolActive),
    armed: Boolean(a.arrowGesturePreview?.armed),
  });
  // W27D FIXUP (fidelidad): durante el clip la UNICA voz sobre la cancha es
  // la frase del ayudante en el remate — el hint de dibujo ("Arrastra de
  // origen a destino...") queda mudo mientras isPlaying, nunca compite con
  // el playback.
  const showHint = Boolean((a.isArrowToolActive || a.grammarBlockNotice) && !a.isPlaying);

  const pitchStatic = (
    <>
      <rect width={PITCH_W} height={PITCH_H} rx="1.2" className="stu-pitch-bg" />
      <path
        d="M5 5H95V59H5Z M50 5V59 M5 21H17V43H5 M95 21H83V43H95 M5 27H10V37H5 M95 27H90V37H95"
        className="stu-pitch-lines"
      />
      <circle cx={50} cy={32} r={8} className="stu-pitch-circle" />
      <circle cx={50} cy={32} r={0.5} className="stu-pitch-dot" />

      {scene.zones.map((zone) => (
        <g
          key={zone.id}
          data-board-target
          onPointerDown={(event) => {
            event.stopPropagation();
            a.onCanvasSelect({ kind: "zone", id: zone.id });
          }}
        >
          {zone.shape === "circle" ? (
            <ellipse
              cx={zone.x + zone.w / 2}
              cy={scaleY(zone.y + zone.h / 2)}
              rx={zone.w / 2}
              ry={scaleY(zone.h) / 2}
              fill={zone.color}
              className="stu-zone"
            />
          ) : (
            <rect
              x={zone.x}
              y={scaleY(zone.y)}
              width={zone.w}
              height={scaleY(zone.h)}
              rx="1.2"
              fill={zone.color}
              className="stu-zone"
            />
          )}
          <text x={zone.x + 1.2} y={scaleY(zone.y) + 3.2} className="stu-zone-label">
            {zone.label}
          </text>
        </g>
      ))}

      {a.zoneDragPreview ? (
        <rect
          x={a.zoneDragPreview.x}
          y={scaleY(a.zoneDragPreview.y)}
          width={a.zoneDragPreview.w}
          height={scaleY(a.zoneDragPreview.h)}
          rx="1.2"
          fill="none"
          stroke={a.color}
          strokeDasharray="1.6 1.2"
          strokeWidth={0.6}
        />
      ) : null}

      {showFocusFx && focusIds.length > 0 ? (
        <ellipse
          cx={focusModelPoint.x}
          cy={scaleY(focusModelPoint.y)}
          rx={10}
          ry={10}
          fill="url(#stu-spotlight-gradient)"
        />
      ) : null}

    </>
  );

  const arrowsLayer = (
    <>
      {scene.arrows.map((arrow) => {
        const style = arrowStyle(arrow.semantic);
        const stroke = arrow.style?.color ?? style.color;
        const fxSeg = fxByArrowId.get(arrow.id);
        const rawProgress = a.playbackArrowProgress?.[arrow.id];

        if (!inPlayback || !fxSeg) {
          const start = endpointPoint(arrow.from, scene.objects);
          const end = endpointPoint(arrow.to, scene.objects);
          const d = style.curved
            ? `M${start.x} ${scaleY(start.y)} Q${(start.x + end.x) / 2} ${scaleY(start.y - 16)} ${end.x} ${scaleY(end.y)}`
            : `M${start.x} ${scaleY(start.y)} L${end.x} ${scaleY(end.y)}`;
          const active = rawProgress !== undefined && rawProgress > 0 && rawProgress < 1;
          return (
            <g
              key={arrow.id}
              data-board-target
              className="stu-arrow-settle"
              onPointerDown={(event) => {
                event.stopPropagation();
                a.onCanvasSelect({ kind: "arrow", id: arrow.id });
              }}
            >
              <path
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={active ? 1.1 : 0.85}
                strokeLinecap="round"
                strokeDasharray={style.dashed ? "1.6 1.2" : undefined}
                opacity={active ? 1 : 0.92}
                markerEnd="url(#stu-arrowhead)"
              />
            </g>
          );
        }

        if (rawProgress === undefined || rawProgress <= 0) return null;
        const drawing = rawProgress < 1;
        // Efecto #1 (trazo que se dibuja solo): un path PARCIAL real
        // (muestreado punto a punto) en vez de revelar un path completo con
        // stroke-dasharray/-dashoffset — esa tecnica combinada con un stroke
        // ancho de round-caps sobre una curva produce "cuentas" visibles en
        // Chrome (defecto de fidelidad reportado y verificado en vivo).
        const d = drawing
          ? partialFxPathD(fxSeg, scaleY, easeInOutQuad(rawProgress))
          : fxPathD(fxSeg, scaleY);
        if (!d) return null;
        return (
          <g key={arrow.id} data-board-target className={drawing ? undefined : "stu-arrow-settle"}>
            {/* Glow: capa ancha/traslucida detras de la crisp — un plano
                simple, sin CSS filter (evita el mismo tipo de artefacto). */}
            {drawing ? (
              <path d={d} fill="none" stroke={stroke} strokeWidth={3.2} strokeLinecap="round" opacity={0.32} />
            ) : null}
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={drawing ? 1.3 : 0.9}
              strokeLinecap="round"
              strokeDasharray={!drawing && style.dashed ? "1.6 1.2" : undefined}
              opacity={drawing ? 1 : 0.95}
              markerEnd={!drawing || rawProgress > 0.92 ? "url(#stu-arrowhead)" : undefined}
            />
          </g>
        );
      })}

      {a.arrowGesturePreview ? (
        <g pointerEvents="none">
          {(() => {
            const start = endpointPoint(a.arrowGesturePreview.origin, scene.objects);
            const end = a.arrowGesturePreview.current;
            const d = `M${start.x} ${scaleY(start.y)} L${end.x} ${scaleY(end.y)}`;
            return (
              <>
                <path
                  d={d}
                  fill="none"
                  stroke="#fff6d8"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  opacity={0.85}
                  filter="url(#stu-marker-roughen)"
                />
                <circle cx={start.x} cy={scaleY(start.y)} r={1.4} fill="#fff6d8" opacity={0.9} />
              </>
            );
          })()}
        </g>
      ) : null}
    </>
  );

  const tokensLayer = (
    <>
      {displayObjects.map((object) => {
        const x = object.position.x;
        const y = scaleY(object.position.y);
        const selected =
          (a.selection?.kind === "object" && a.selection.id === object.id) ||
          object.id === a.anchorOriginId;

        if (object.type === "note") {
          return (
            <g
              key={object.id}
              data-board-target
              data-object-id={object.id}
              onPointerDown={(event) => handleTokenPointerDown(event, object.id)}
            >
              <rect x={x} y={y - 4} width={17} height={7} rx={1.2} className={selected ? "stu-note selected" : "stu-note"} />
              <text x={x + 1.2} y={y - 1.4} className="stu-note-text">
                {object.label}
              </text>
            </g>
          );
        }
        if (object.type === "equipmentMarker") {
          return (
            <g
              key={object.id}
              data-board-target
              data-object-id={object.id}
              onPointerDown={(event) => handleTokenPointerDown(event, object.id)}
            >
              <rect
                x={x - 1.6}
                y={y - 1.6}
                width={3.2}
                height={3.2}
                rx={0.4}
                className={selected ? "stu-equipment selected" : "stu-equipment"}
              />
              <text x={x + 2.2} y={y + 1} className="stu-equipment-label">
                {object.label}
              </text>
            </g>
          );
        }
        if (object.type === "ball") {
          const segment = activeSegmentFor(object.id);
          const trail = segment && segment.kind !== "player" ? sampleTrail(segment, a.playbackTime, 4, 0.045) : [];
          let scale = 1;
          if (segment) {
            const intoSegment = a.playbackTime - segment.start;
            const toEnd = segment.end - a.playbackTime;
            if (intoSegment >= 0 && intoSegment <= 0.12) {
              scale = 1 + 0.25 * Math.sin((intoSegment / 0.12) * Math.PI);
            } else if (toEnd >= 0 && toEnd <= 0.1) {
              scale = 1 + 0.15 * (toEnd / 0.1);
            }
          }
          return (
            <g key={object.id} className="stu-token" data-board-target data-object-id={object.id}>
              {trail.map((point, index) => (
                <circle
                  key={`${index}-${point.point.x.toFixed(1)}-${point.point.y.toFixed(1)}`}
                  cx={point.point.x}
                  cy={scaleY(point.point.y)}
                  r={1.1 * point.opacity}
                  fill="#f4f1e6"
                  opacity={point.opacity * 0.5}
                />
              ))}
              <circle
                cx={x}
                cy={y}
                r={1.15 * scale}
                fill="#f4f1e6"
                stroke="#0b1712"
                strokeWidth={0.22}
                onPointerDown={(event) => handleTokenPointerDown(event, object.id)}
              />
            </g>
          );
        }

        const rival = object.type === "opponentToken";
        const segment = activeSegmentFor(object.id);
        const trail = segment ? sampleTrail(segment, a.playbackTime, 3, 0.09) : [];
        const lean = segment ? (segment.to.x >= segment.from.x ? 4 : -4) : 0;
        const dimmed = showFocusFx && focusIds.length > 0 && !focusIds.includes(object.id);
        return (
          <g
            key={object.id}
            className="stu-token"
            data-board-target
            data-object-id={object.id}
            opacity={dimmed ? 0.4 : 1}
            onPointerDown={(event) => handleTokenPointerDown(event, object.id)}
          >
            {trail.map((point, index) => (
              <circle
                key={`${index}-${point.point.x.toFixed(1)}-${point.point.y.toFixed(1)}`}
                cx={point.point.x}
                cy={scaleY(point.point.y)}
                r={1.4}
                fill={rival ? RIVAL_MARKER_COLOR : OWN_MARKER_COLOR}
                opacity={point.opacity * 0.3}
              />
            ))}
            <g
              className={segment ? "stu-fx-runner" : undefined}
              style={
                segment
                  ? ({
                      transformOrigin: `${x}px ${y}px`,
                      transformBox: "fill-box",
                      "--stu-lean": `${lean}deg`,
                    } as unknown as CSSProperties)
                  : undefined
              }
            >
              <circle
                cx={x}
                cy={y}
                r={2.15}
                fill={rival ? "rgba(255,107,94,0.08)" : OWN_MARKER_COLOR}
                stroke={selected ? "#37e3b3" : rival ? RIVAL_MARKER_COLOR : "#0b1712"}
                strokeWidth={selected ? 0.55 : rival ? 0.5 : 0.3}
                strokeDasharray={rival ? "1 0.7" : undefined}
              />
              <text x={x} y={y + 0.7} textAnchor="middle" className="stu-token-number" fill={rival ? RIVAL_MARKER_COLOR : "#0b1712"}>
                {object.number ?? ""}
              </text>
              <text x={x} y={y + 4.4} textAnchor="middle" className="stu-token-name">
                {object.label?.split(" ")[0]?.slice(0, 8) ?? ""}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );

  // W27 FIXUP (fidelidad): durante playback las fichas atenuadas igual se
  // pintaban ENCIMA del trazo vivo (mismo orden que en edicion), rompiendo
  // la continuidad visual de la linea contra formaciones en columna — se
  // veia como "cuentas"/mancha en vez de un trazo limpio. Fix: solo durante
  // playback, la capa de flechas se pinta DESPUES de las fichas; en
  // edicion el orden queda igual que siempre (flechas debajo de fichas).
  const pitchContent = inPlayback ? (
    <>
      {pitchStatic}
      {tokensLayer}
      {arrowsLayer}
    </>
  ) : (
    <>
      {pitchStatic}
      {arrowsLayer}
      {tokensLayer}
    </>
  );

  return (
    <div className="stu-studio">
      <style>{STUDIO_STYLES}</style>

      <StudioRail
        activeTool={a.tool}
        color={a.color}
        isTrazoActive={isTrazoActive}
        onPress={onRailButtonPress}
        onSetColor={a.setColor}
      />

      <main className="stu-stage">
        <div className="stu-eyebrow">
          ESTUDIO <b>TÁCTICO</b>
        </div>
        <StudioPlayname title={scene.title} onChange={a.updateSceneTitle} />
        <button
          type="button"
          className="stu-drawer-tab"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir lecturas, roles y notas"
        >
          LECTURAS · ROLES · NOTAS
        </button>

        {showHint && hintText ? (
          <p className={`stu-hint${a.grammarBlockNotice ? " block" : ""}`}>{hintText}</p>
        ) : null}

        <div className="stu-pitch-wrap">
          <svg
            ref={svgRef}
            className="stu-pitch"
            viewBox={viewBoxAttr}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            role="img"
            aria-label="Cancha tactica"
          >
            <defs>
              <marker id="stu-arrowhead" markerWidth={4} markerHeight={4} refX={3} refY={2} orient="auto">
                <path d="M0,0 L4,2 L0,4 Z" fill="#f4f1e6" />
              </marker>
              <filter id="stu-marker-roughen" x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={4} result="stu-noise" />
                <feDisplacementMap in="SourceGraphic" in2="stu-noise" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <radialGradient id="stu-spotlight-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f4f1e6" stopOpacity="0.32" />
                <stop offset="65%" stopColor="#f4f1e6" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#f4f1e6" stopOpacity="0" />
              </radialGradient>
            </defs>
            {pitchContent}
          </svg>
        </div>

        {finalePhrase ? (
          <div key={finalePhrase.key} className="stu-finale">
            {finalePhrase.text}
          </div>
        ) : null}

        {drawerOpen ? (
          <StudioDrawer
            scene={scene}
            tacticalReads={a.tacticalReads}
            hasAnyOwnRoleAssigned={a.hasAnyOwnRoleAssigned}
            onNotesChange={a.updateSceneNotes}
            onClose={() => setDrawerOpen(false)}
          />
        ) : null}
      </main>

      <StudioDeck
        scenes={board.scenes}
        currentSceneId={scene.id}
        onSelectScene={a.selectScene}
        onAddScene={a.addScene}
        isPlaying={a.isPlaying}
        playbackTime={a.playbackTime}
        playbackDuration={a.playbackDuration}
        playbackSpeed={a.playbackSpeed}
        onPlay={a.playPlayback}
        onPause={a.pausePlayback}
        onScrub={a.setPlaybackTime}
        onToggleSpeed={a.togglePlaybackSpeed}
        saveIndicator={a.saveIndicator}
        saveKey={a.lastSavedAt}
      />
    </div>
  );
}

function StudioPlayname({ title, onChange }: { title: string; onChange: (next: string) => void }) {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) onChange(trimmed);
    else setValue(title);
  };
  return (
    <input
      className="stu-playname"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        if (event.key === "Escape") setValue(title);
      }}
      aria-label="Nombre de la jugada"
    />
  );
}

function StudioRail({
  activeTool,
  color,
  isTrazoActive,
  onPress,
  onSetColor,
}: {
  activeTool: BoardTool;
  color: string;
  isTrazoActive: (button: StudioRailButton) => boolean;
  onPress: (button: StudioRailButton) => void;
  onSetColor: (color: string) => void;
}) {
  void activeTool;
  return (
    <aside className="stu-rail">
      <div className="stu-brand">
        ROMBO<b>IQ</b> · ESTUDIO TÁCTICO
      </div>
      {STUDIO_TOOL_GROUPS.map((group) => (
        <div className="stu-group" key={group.id}>
          <h3>{group.label}</h3>
          <div className="stu-tools">
            {group.buttons.map((button) => (
              <button
                key={button.id}
                type="button"
                className={`stu-tool${isTrazoActive(button) ? " active" : ""}`}
                onClick={() => onPress(button)}
              >
                <span className="stu-glyph">
                  <StudioToolIcon id={button.tool ?? button.id} />
                </span>
                {button.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="stu-group">
        <h3>MARCADOR</h3>
        <div className="stu-markers">
          <button
            type="button"
            className="stu-marker own"
            aria-label="Marcador equipo propio"
            aria-pressed={color === OWN_MARKER_COLOR}
            onClick={() => onSetColor(OWN_MARKER_COLOR)}
          />
          <button
            type="button"
            className="stu-marker rival"
            aria-label="Marcador rival"
            aria-pressed={color === RIVAL_MARKER_COLOR}
            onClick={() => onSetColor(RIVAL_MARKER_COLOR)}
          />
          <span>PROPIO / RIVAL</span>
        </div>
      </div>
    </aside>
  );
}

function StudioDeck({
  scenes,
  currentSceneId,
  onSelectScene,
  onAddScene,
  isPlaying,
  playbackTime,
  playbackDuration,
  playbackSpeed,
  onPlay,
  onPause,
  onScrub,
  onToggleSpeed,
  saveIndicator,
  saveKey,
}: {
  scenes: TacticalBoard["scenes"];
  currentSceneId: string;
  onSelectScene: (id: string) => void;
  onAddScene: () => void;
  isPlaying: boolean;
  playbackTime: number;
  playbackDuration: number;
  playbackSpeed: 1 | 2;
  onPlay: () => void;
  onPause: () => void;
  onScrub: (time: number) => void;
  onToggleSpeed: () => void;
  saveIndicator: string;
  saveKey: number;
}) {
  const hasPlayback = playbackDuration > 0;
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const progress = hasPlayback ? Math.min(1, playbackTime / playbackDuration) : 0;

  const onScrubPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasPlayback) return;
    const move = (clientX: number) => {
      const rect = scrubRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      onScrub(ratio * playbackDuration);
    };
    move(event.clientX);
    const onMove = (ev: PointerEvent) => move(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <footer className="stu-deck">
      <button
        type="button"
        className="stu-play-btn"
        disabled={!hasPlayback}
        aria-label={isPlaying ? "Pausar reproduccion" : "Reproducir jugada"}
        onClick={isPlaying ? onPause : onPlay}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          {isPlaying ? (
            <>
              <rect x={4} y={4} width={4} height={12} fill="#0b1712" />
              <rect x={12} y={4} width={4} height={12} fill="#0b1712" />
            </>
          ) : (
            <path d="M6 4l10 6-10 6z" fill="#0b1712" />
          )}
        </svg>
      </button>
      <div className="stu-timeline">
        <div className="stu-scenes">
          {scenes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`stu-scene${item.id === currentSceneId ? " active" : ""}`}
              onClick={() => onSelectScene(item.id)}
            >
              {item.title}
            </button>
          ))}
          <button type="button" className="stu-scene stu-scene-new" onClick={onAddScene}>
            + ESCENA
          </button>
        </div>
        <div className="stu-scrub" ref={scrubRef} onPointerDown={onScrubPointerDown}>
          <div className="stu-scrub-fill" style={{ width: `${progress * 100}%` }} />
          <div className="stu-scrub-knob" style={{ left: `${progress * 100}%` }} />
        </div>
      </div>
      <button type="button" className="stu-speed" disabled={!hasPlayback} onClick={onToggleSpeed}>
        {playbackSpeed}×
      </button>
      <span className="stu-save" key={saveKey} aria-live="polite">
        {saveIndicator}
      </span>
      <div className="stu-clock">
        {playbackTime.toFixed(1)} / {playbackDuration.toFixed(1)}s
      </div>
    </footer>
  );
}

function StudioDrawer({
  scene,
  tacticalReads,
  hasAnyOwnRoleAssigned,
  onNotesChange,
  onClose,
}: {
  scene: BoardScene;
  tacticalReads: Array<{ id: string; text: string }>;
  hasAnyOwnRoleAssigned: boolean;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(scene.notes);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scene.id is deliberate here (not just scene.notes) — switching scenes must reset the draft even when two scenes coincidentally share the same notes string
  useEffect(() => setNotes(scene.notes), [scene.id, scene.notes]);

  const ownTokensWithRole = scene.objects.filter(
    (object) => object.type === "playerToken" && Boolean(object.role?.trim()),
  );

  return (
    <aside className="stu-drawer open">
      <button type="button" className="stu-drawer-close" onClick={onClose} aria-label="Cerrar panel">
        ×
      </button>
      <h4>QUÉ ENTIENDE ROMBOIQ</h4>
      {tacticalReads.length > 0 ? (
        tacticalReads.map((read) => (
          <div className="stu-read" key={read.id}>
            {read.text}
          </div>
        ))
      ) : (
        <p className="stu-drawer-note">
          {hasAnyOwnRoleAssigned
            ? "Sin lectura por ahora — la escena esta equilibrada."
            : "Asigná un rol a algún jugador propio para que RomboIQ empiece a leer la escena."}
        </p>
      )}
      <h4>ROLES</h4>
      {ownTokensWithRole.length > 0 ? (
        <p className="stu-drawer-note">
          {ownTokensWithRole.map((token, index) => (
            <span key={token.id}>
              {index > 0 ? <br /> : null}
              {token.number ?? ""} — {token.role}
            </span>
          ))}
        </p>
      ) : (
        <p className="stu-drawer-note">Sin roles asignados en esta escena.</p>
      )}
      <h4>NOTAS DEL CUERPO TÉCNICO</h4>
      <textarea
        className="stu-drawer-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => onNotesChange(notes)}
        placeholder="Notas para el plantel…"
      />
    </aside>
  );
}

const STUDIO_STYLES = `
:root {
  --stu-felt-deep: #0b1712;
  --stu-felt-panel: #122419;
  --stu-felt-panel-2: #162b1f;
  --stu-felt-pitch: #1a3326;
  --stu-felt-line: rgba(232, 228, 213, 0.55);
  --stu-ink: #f4f1e6;
  --stu-ink-dim: rgba(244, 241, 230, 0.55);
  --stu-token-own: #f2c230;
  --stu-token-rival: #ff6b5e;
  --stu-arrow-mint: #37e3b3;
  --stu-mono: ui-monospace, "Cascadia Mono", "Consolas", monospace;
  --stu-sans: "Segoe UI", system-ui, sans-serif;
  --stu-marker-font: "Segoe Print", "Bradley Hand", cursive;
}
.stu-studio {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: 224px 1fr;
  grid-template-rows: 1fr 74px;
  grid-template-areas: "rail stage" "rail deck";
  gap: 10px;
  padding: 10px;
  background: var(--stu-felt-deep);
  color: var(--stu-ink);
  font-family: var(--stu-sans);
  overflow: hidden;
}
.stu-rail {
  grid-area: rail;
  background: var(--stu-felt-panel);
  border: 1px solid rgba(232,228,213,0.08);
  border-radius: 14px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.stu-brand {
  font-family: var(--stu-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--stu-ink-dim);
  padding: 2px 4px 8px;
  border-bottom: 1px solid rgba(232,228,213,0.1);
}
.stu-brand b { color: var(--stu-token-own); font-weight: 700; }
.stu-group { display: flex; flex-direction: column; gap: 4px; }
.stu-group h3 {
  font-family: var(--stu-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--stu-ink-dim);
  padding: 6px 4px 2px;
}
.stu-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
/* W27D FIXUP (fidelidad): el reset global "button:not(.secondary)" de
   theme.css (specificidad 0,2,0, pinta TODOS los <button> como pildora
   dorada) le ganaba a ".stu-tool" (0,1,0) por especificidad, sin importar
   el orden — mismo patron ya documentado para .rombo-playback-toggle.
   Fix: escalar la especificidad con el contenedor, no tocar theme.css. */
.stu-studio .stu-rail .stu-tool {
  display: flex; align-items: center; gap: 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--stu-ink);
  font-family: var(--stu-sans);
  font-size: 11.5px;
  padding: 6px 7px;
  cursor: pointer;
  text-align: left;
  min-height: 34px;
  box-shadow: none;
  transform: none;
}
.stu-studio .stu-rail .stu-tool:hover { background: rgba(232,228,213,0.06); transform: none; }
.stu-studio .stu-rail .stu-tool:active { transform: scale(0.97); }
.stu-studio .stu-rail .stu-tool.active {
  background: rgba(242,194,48,0.14);
  border-color: rgba(242,194,48,0.55);
}
.stu-glyph { width: 16px; height: 16px; flex: none; display: grid; place-items: center; }
.stu-glyph svg { width: 16px; height: 16px; display: block; }
.stu-markers { display: flex; gap: 6px; padding: 2px 4px; align-items: center; }
.stu-marker { width: 26px; height: 26px; border-radius: 999px; border: 2px solid rgba(232,228,213,0.2); cursor: pointer; }
.stu-marker.own { background: var(--stu-token-own); border-color: rgba(242,194,48,0.8); }
.stu-marker.rival { background: transparent; border: 2px dashed var(--stu-token-rival); }
.stu-marker[aria-pressed="true"] { outline: 2px solid var(--stu-arrow-mint); outline-offset: 2px; }
.stu-markers span { font-family: var(--stu-mono); font-size: 9.5px; color: var(--stu-ink-dim); letter-spacing: 0.1em; }

.stu-stage {
  grid-area: stage;
  position: relative;
  background: var(--stu-felt-panel);
  border: 1px solid rgba(232,228,213,0.08);
  border-radius: 14px;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.stu-eyebrow {
  position: absolute; top: 10px; left: 14px; z-index: 5;
  font-family: var(--stu-mono); font-size: 10px; letter-spacing: 0.16em;
  color: var(--stu-ink-dim);
}
.stu-eyebrow b { color: var(--stu-arrow-mint); font-weight: 600; }
.stu-playname {
  position: absolute; top: 8px; right: 56px; z-index: 5;
  font-family: var(--stu-marker-font); font-size: 21px; color: var(--stu-ink);
  opacity: 0.9; transform: rotate(-1.2deg);
  background: transparent; border: none; text-align: right;
  max-width: 60%;
}
.stu-playname:focus { outline: none; opacity: 1; }
.stu-drawer-tab {
  position: absolute; right: 0; top: 50%; z-index: 6;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  background: var(--stu-felt-panel-2);
  border: 1px solid rgba(232,228,213,0.14);
  border-right: none;
  border-radius: 10px 0 0 10px;
  color: var(--stu-ink-dim);
  font-family: var(--stu-mono); font-size: 10px; letter-spacing: 0.18em;
  padding: 14px 7px; cursor: pointer;
}
.stu-hint {
  position: absolute; top: 30px; left: 50%; transform: translateX(-50%);
  z-index: 5; margin: 0; font-size: 12px; color: var(--stu-ink-dim);
  pointer-events: none; max-width: 80%; text-align: center;
}
.stu-hint.block { color: #ff8a75; }
.stu-drawer {
  position: absolute; right: 0; top: 0; bottom: 0; z-index: 7;
  width: 264px; max-width: 78vw;
  background: rgba(18, 36, 25, 0.97);
  border-left: 1px solid rgba(232,228,213,0.14);
  padding: 18px 16px;
  display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto;
  animation: stu-drawer-in 240ms cubic-bezier(.2,.8,.2,1);
}
@keyframes stu-drawer-in {
  0% { transform: translateX(100%); }
  100% { transform: translateX(0); }
}
.stu-drawer h4 { font-family: var(--stu-mono); font-size: 10px; letter-spacing: 0.16em; color: var(--stu-ink-dim); font-weight: 600; }
.stu-read {
  border: 1px solid rgba(55,227,179,0.35);
  background: rgba(55,227,179,0.07);
  border-radius: 10px; padding: 10px 12px;
  font-size: 13px; line-height: 1.45;
}
.stu-drawer-close {
  position: absolute; top: 10px; right: 12px;
  background: none; border: none; color: var(--stu-ink-dim);
  font-size: 16px; cursor: pointer;
}
.stu-drawer-note { font-size: 12px; color: var(--stu-ink-dim); line-height: 1.5; }
.stu-drawer-notes {
  min-height: 90px;
  border-radius: 10px;
  border: 1px solid rgba(232,228,213,0.2);
  background: rgba(0,0,0,0.2);
  color: var(--stu-ink);
  padding: 10px;
  font: inherit;
  resize: vertical;
}

.stu-pitch-wrap { width: 100%; height: 100%; display: grid; place-items: center; padding: 34px 26px 12px; }
.stu-pitch { width: 100%; height: 100%; aspect-ratio: ${PITCH_W} / ${PITCH_H}; touch-action: none; }
.stu-pitch-bg { fill: var(--stu-felt-pitch); stroke: var(--stu-felt-line); stroke-width: 1.2; }
.stu-pitch-lines { fill: none; stroke: var(--stu-felt-line); stroke-width: 0.35; }
.stu-pitch-circle { fill: none; stroke: var(--stu-felt-line); stroke-width: 0.3; }
.stu-pitch-dot { fill: var(--stu-felt-line); }
.stu-zone { opacity: 0.6; }
.stu-zone-label { font-size: 2px; fill: var(--stu-ink-dim); }
.stu-note { fill: rgba(244,241,230,0.14); stroke: var(--stu-ink-dim); stroke-width: 0.2; }
.stu-note.selected { stroke: var(--stu-arrow-mint); }
.stu-note-text { font-size: 2.4px; fill: var(--stu-ink); }
.stu-equipment { fill: var(--stu-ink-dim); }
.stu-equipment.selected { fill: var(--stu-arrow-mint); }
.stu-equipment-label { font-size: 2.2px; fill: var(--stu-ink-dim); }
.stu-token-number { font-size: 2.3px; font-weight: 900; }
.stu-token-name { font-size: 1.6px; fill: rgba(244,241,230,0.7); }
.stu-arrow-settle path { animation: stu-settle 260ms ease-out; }
@keyframes stu-settle { 0% { opacity: 0.3; stroke-width: 2.2; } 100% { opacity: 1; } }
.stu-token { transition: opacity 220ms ease; }
.stu-fx-runner { transform-box: fill-box; transform-origin: center; animation: stu-fx-bob 480ms ease-in-out infinite; }
@keyframes stu-fx-bob {
  0% { transform: rotate(var(--stu-lean, 0deg)) scale(1); }
  50% { transform: rotate(var(--stu-lean, 0deg)) scale(1.03); }
  100% { transform: rotate(var(--stu-lean, 0deg)) scale(1); }
}
.stu-finale {
  position: absolute; left: 50%; bottom: 18%; transform: translateX(-50%);
  background: rgba(11,23,18,0.92);
  border: 1px solid rgba(55,227,179,0.5);
  color: var(--stu-ink);
  font-size: 15px;
  border-radius: 999px;
  padding: 9px 20px;
  z-index: 6;
  white-space: nowrap;
  pointer-events: none;
  animation: stu-finale-in 2.6s cubic-bezier(.2,.9,.25,1) forwards;
}
@keyframes stu-finale-in {
  0% { opacity: 0; transform: translate(-50%, 8px); }
  12% { opacity: 1; transform: translate(-50%, 0); }
  86% { opacity: 1; }
  100% { opacity: 0; }
}

.stu-deck {
  grid-area: deck;
  background: var(--stu-felt-panel);
  border: 1px solid rgba(232,228,213,0.08);
  border-radius: 14px;
  display: flex; align-items: center; gap: 14px;
  padding: 0 16px;
  min-width: 0;
}
/* W27D FIXUP (fidelidad): mismo problema de especificidad que .stu-tool —
   escalado via el contenedor para ganarle al reset global de theme.css. */
.stu-studio .stu-deck .stu-play-btn {
  flex: none; width: 52px; height: 52px; border-radius: 50%;
  border: none; cursor: pointer;
  background: var(--stu-token-own);
  display: grid; place-items: center;
  box-shadow: 0 4px 18px rgba(242,194,48,0.35);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.stu-studio .stu-deck .stu-play-btn:hover { transform: scale(1.06); }
.stu-studio .stu-deck .stu-play-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.stu-play-btn svg { width: 20px; height: 20px; display: block; }
.stu-timeline { flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.stu-scenes { display: flex; gap: 6px; overflow-x: auto; }
.stu-scene {
  font-family: var(--stu-mono); font-size: 10px; letter-spacing: 0.08em;
  color: var(--stu-ink-dim);
  background: transparent;
  border: 1px solid rgba(232,228,213,0.16);
  border-radius: 999px; padding: 3px 12px; cursor: pointer;
  white-space: nowrap;
}
.stu-scene.active { color: var(--stu-felt-deep); background: var(--stu-arrow-mint); border-color: var(--stu-arrow-mint); font-weight: 700; }
.stu-scene-new { border-style: dashed; }
.stu-scrub { position: relative; height: 8px; border-radius: 999px; background: rgba(232,228,213,0.12); cursor: pointer; }
.stu-scrub-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--stu-arrow-mint); }
.stu-scrub-knob {
  position: absolute; top: 50%; width: 16px; height: 16px; border-radius: 50%;
  background: var(--stu-ink); transform: translate(-50%, -50%);
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.stu-speed {
  flex: none; font-family: var(--stu-mono); font-size: 11px; color: var(--stu-ink-dim);
  background: transparent; border: 1px solid rgba(232,228,213,0.16);
  border-radius: 999px; padding: 5px 12px; cursor: pointer;
}
.stu-speed:disabled { opacity: 0.4; cursor: not-allowed; }
.stu-save { flex: none; font-family: var(--stu-mono); font-size: 10px; color: var(--stu-ink-dim); white-space: nowrap; }
.stu-clock { flex: none; font-family: var(--stu-mono); font-size: 11px; color: var(--stu-ink-dim); font-variant-numeric: tabular-nums; min-width: 84px; text-align: right; }

@media (max-width: 760px) {
  .stu-studio {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto 64px;
    grid-template-areas: "stage" "rail" "deck";
    gap: 8px; padding: 8px;
  }
  .stu-rail { flex-direction: row; align-items: stretch; overflow-x: auto; overflow-y: hidden; padding: 8px; gap: 14px; max-height: 118px; }
  .stu-brand { display: none; }
  .stu-group { flex: none; }
  .stu-tools { grid-template-columns: repeat(3, auto); gap: 3px; }
  .stu-tool { font-size: 10.5px; min-height: 30px; padding: 4px 6px; }
  .stu-pitch-wrap { padding: 30px 8px 8px; }
  .stu-playname { font-size: 16px; right: 12px; }
  .stu-deck { padding: 0 10px; gap: 10px; border-radius: 12px; }
  .stu-play-btn { width: 44px; height: 44px; }
  .stu-scenes { display: none; }
  .stu-clock { display: none; }
  .stu-save { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .stu-drawer, .stu-finale, .stu-tool, .stu-play-btn, .stu-fx-runner, .stu-arrow-settle path { animation: none; }
}
`;
