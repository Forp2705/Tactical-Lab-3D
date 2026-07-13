import type { MutableRefObject, PointerEvent } from "react";
import {
  type BoardTool,
  FORMATIONS,
  PITCH_H,
  PITCH_W,
  type Selection,
} from "../boardConstants";
import {
  clamp,
  endpointPoint,
  layerVisibleForArrow,
  pointFromSvgEvent,
  scaleY,
  shortName,
  zoneVisible,
} from "../boardGeometry";
import { arrowStyle } from "../boardActionStyle";
import type {
  BoardArrowEndpoint,
  BoardObject,
  BoardPoint,
  BoardScene,
} from "../boardModel";
import type { ConsequenceOverlay } from "../scenarioBoardConsequence";
import type { TacticalRead } from "../boardTacticalRead";
import { resolveArrowHintText } from "../boardTools";

// Resuelve el objectId bajo un punto de release (pointerup) leyendo el DOM:
// a diferencia del pointerdown (cada token pasa su propio id via closure), el
// release puede caer sobre CUALQUIER token, asi que hace falta el atributo
// data-object-id (agregado a cada BoardObjectNode) + closest() en el target
// nativo del evento (W24A: necesario para resolver el destino de un drag).
function resolveTargetIdFromEvent(event: PointerEvent<SVGSVGElement>) {
  const el = (event.target as Element).closest("[data-object-id]");
  return el?.getAttribute("data-object-id") ?? undefined;
}

type TacticalBoardCanvasProps = {
  svgRef: MutableRefObject<SVGSVGElement | null>;
  scene: BoardScene;
  selection: Selection;
  color: string;
  lineWidth: number;
  tool: BoardTool;
  activeLayers: Set<string>;
  zoom: number;
  teamAFormation: string;
  opponentFormation: string;
  // Token origen de un anclaje en curso (se resalta mientras se dibuja).
  anchorOriginId?: string;
  // Rubber-band de un drag-to-create de zona/bloque en curso (W8). Misma
  // resolucion (umbral/normalizacion) que el commit final del pointerup, asi
  // que la preview siempre coincide con lo que se va a crear.
  zoneDragPreview?: { x: number; y: number; w: number; h: number; block: boolean } | null;
  // Rubber-band de un gesto de flecha en curso (W24A): visible tanto durante
  // el drag real como en el fallback click-click ya armado (`armed` distingue
  // el texto de estado que se muestra).
  arrowGesturePreview?: {
    origin: BoardArrowEndpoint;
    current: BoardPoint;
    armed: boolean;
  } | null;
  // Hint contextual minimo (how-to, W24A H3): se muestra mientras una tool de
  // flecha esta activa, no un manual — un renglon que explica ambas
  // gramaticas (drag y click-click) y como cancelar.
  isArrowToolActive?: boolean;
  // FIXUP W25B: razon de un block de gramatica tactica vigente. Le gana al
  // hint pasivo de arriba (resolveArrowHintText decide la prioridad); vive
  // ARROW_BLOCK_HINT_TTL_MS o hasta el proximo gesto real, controlado por
  // useBoardActions — este componente solo renderiza lo que le llega.
  grammarBlockNotice?: { reason: string; key: number } | null;
  // Proyeccion efimera de RomboIQ (preview); su geometria es identica a la que
  // se commitea al aceptar — solo cambia el estilo (ghost/punteado) para senalar
  // que todavia no es parte de la escena.
  consequenceOverlay: ConsequenceOverlay | null;
  // Reactive board engine (mc-21): ephemeral snapshot shown ONLY on drop
  // (pointerup), cleared by its own timeout in useBoardActions — never
  // driven by pointermove, never a toast/dialog (W4 pointer-events + no
  // dialogs invariants). `key` forces the pulse animation to restart on
  // every new drop even if the reads are identical to the last one.
  tacticalOverlay: { reads: TacticalRead[]; key: number } | null;
  keyInstructions: {
    objective: string;
    rule: string;
    successCondition: string;
  };
  onSelect: (selection: Selection) => void;
  onPointerDown: (point: BoardPoint, targetId?: string) => void;
  onPointerMove: (point: BoardPoint) => void;
  onPointerUp: (point: BoardPoint, targetId?: string) => void;
  onOwnFormationChange: (formation: string) => void;
  onOpponentFormationChange: (formation: string) => void;
};

export function TacticalBoardCanvas({
  svgRef,
  scene,
  selection,
  color,
  lineWidth,
  tool,
  activeLayers,
  zoom,
  teamAFormation,
  opponentFormation,
  anchorOriginId,
  zoneDragPreview,
  arrowGesturePreview,
  isArrowToolActive,
  grammarBlockNotice,
  consequenceOverlay,
  tacticalOverlay,
  keyInstructions,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onOwnFormationChange,
  onOpponentFormationChange,
}: TacticalBoardCanvasProps) {
  return (
    <section className="rombo-pitch-panel">
      <div className="rombo-pitch-toolbar">
        <select
          value={teamAFormation}
          onChange={(event) => onOwnFormationChange(event.target.value)}
        >
          {FORMATIONS.map((formation) => (
            <option key={formation}>{formation}</option>
          ))}
        </select>
        <select
          value={opponentFormation}
          onChange={(event) => onOpponentFormationChange(event.target.value)}
        >
          {FORMATIONS.map((formation) => (
            <option key={formation}>{formation}</option>
          ))}
        </select>
      </div>
      {/* Hint minimo how-to (W24A H3): un renglon, solo mientras una tool de
          flecha esta activa — no un manual. pointer-events:none (invariante
          W4: nunca robarle eventos a la cancha). FIXUP W25B: una razon de
          block vigente le gana a este hint en el MISMO renglon (nunca
          conviven) — resolveArrowHintText decide la prioridad, esta seccion
          solo cambia estilo/aria-live segun cual de las dos gano. */}
      {(() => {
        const hintText = resolveArrowHintText({
          grammarBlockReason: grammarBlockNotice?.reason ?? null,
          isArrowToolActive: Boolean(isArrowToolActive),
          armed: Boolean(arrowGesturePreview?.armed),
        });
        if (!hintText) return null;
        return (
          <p
            key={grammarBlockNotice ? `block-${grammarBlockNotice.key}` : "hint"}
            className={
              grammarBlockNotice
                ? "rombo-arrow-hint rombo-arrow-hint-block"
                : "rombo-arrow-hint"
            }
            aria-live={grammarBlockNotice ? "assertive" : "polite"}
          >
            {hintText}
          </p>
        );
      })()}
      <TacticalPitch
        refEl={svgRef}
        scene={scene}
        selected={selection}
        color={color}
        lineWidth={lineWidth}
        tool={tool}
        activeLayers={activeLayers}
        zoom={zoom}
        anchorOriginId={anchorOriginId}
        zoneDragPreview={zoneDragPreview}
        arrowGesturePreview={arrowGesturePreview}
        consequenceOverlay={consequenceOverlay}
        tacticalOverlay={tacticalOverlay}
        onSelect={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {/* W15: colapsado por defecto — abierto tapaba el pitch; el summary es
          la unica superficie clickeable (el resto sigue pointer-events:none
          para no robarle eventos a la cancha, invariante W4). */}
      <details className="rombo-key-instructions">
        <summary>Instrucciones clave</summary>
        <ul>
          <li>{keyInstructions.objective}</li>
          <li>{keyInstructions.rule}</li>
          <li>{keyInstructions.successCondition}</li>
        </ul>
      </details>
    </section>
  );
}

function TacticalPitch({
  refEl,
  scene,
  selected,
  color,
  lineWidth,
  tool,
  activeLayers,
  zoom,
  anchorOriginId,
  zoneDragPreview,
  arrowGesturePreview,
  consequenceOverlay,
  tacticalOverlay,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  refEl: MutableRefObject<SVGSVGElement | null>;
  scene: BoardScene;
  selected: Selection;
  color: string;
  lineWidth: number;
  tool: BoardTool;
  activeLayers: Set<string>;
  zoom: number;
  anchorOriginId?: string;
  zoneDragPreview?: { x: number; y: number; w: number; h: number; block: boolean } | null;
  arrowGesturePreview?: {
    origin: BoardArrowEndpoint;
    current: BoardPoint;
    armed: boolean;
  } | null;
  consequenceOverlay: ConsequenceOverlay | null;
  tacticalOverlay: { reads: TacticalRead[]; key: number } | null;
  onSelect: (selection: Selection) => void;
  onPointerDown: (point: BoardPoint, targetId?: string) => void;
  onPointerMove: (point: BoardPoint) => void;
  onPointerUp: (point: BoardPoint, targetId?: string) => void;
}) {
  const visibleObjects = scene.objects.filter((object) => {
    if (object.type === "opponentToken" && !activeLayers.has("defense"))
      return false;
    if (object.type === "note" && !activeLayers.has("attack")) return false;
    return true;
  });
  const visibleArrows = scene.arrows.filter((arrow) =>
    layerVisibleForArrow(arrow, activeLayers),
  );
  const visibleZones = scene.zones.filter((zone) =>
    zoneVisible(zone.semantic, activeLayers),
  );

  const pointFromEvent = (event: PointerEvent<SVGSVGElement>): BoardPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  // `tool` is part of the public props contract even though the SVG itself does
  // not branch on it; the parent uses it to drive pointer behavior.
  void tool;

  return (
    <svg
      ref={refEl}
      className="rombo-pitch-svg"
      viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
      style={{ transform: `scale(${zoom / 100})` }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("[data-board-target]")) return;
        onPointerDown(pointFromEvent(event));
      }}
      onPointerMove={(event) => onPointerMove(pointFromEvent(event))}
      onPointerUp={(event) =>
        onPointerUp(pointFromEvent(event), resolveTargetIdFromEvent(event))
      }
      role="img"
      aria-label="Cancha tactica interactiva"
    >
      <defs>
        <marker
          id="rombo-arrow-head"
          markerWidth="4"
          markerHeight="4"
          refX="3"
          refY="2"
          orient="auto"
        >
          <path d="M0,0 L4,2 L0,4 Z" fill={color} />
        </marker>
      </defs>
      <rect width="100" height="64" rx="1.5" className="pitch-bg" />
      <path
        d="M5 5H95V59H5Z M50 5V59 M5 21H17V43H5 M95 21H83V43H95 M5 27H10V37H5 M95 27H90V37H95"
        className="pitch-lines"
      />
      <circle cx="50" cy="32" r="8" className="pitch-lines-fill" />
      <circle cx="50" cy="32" r="0.45" className="pitch-dot" />

      {visibleZones.map((zone) => (
        <g
          key={zone.id}
          data-board-target
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect({ kind: "zone", id: zone.id });
          }}
        >
          {zone.shape === "circle" ? (
            <ellipse
              cx={zone.x + zone.w / 2}
              cy={scaleY(zone.y + zone.h / 2)}
              rx={zone.w / 2}
              ry={scaleY(zone.h) / 2}
              fill={zone.color}
              className="board-zone"
            />
          ) : (
            <rect
              x={zone.x}
              y={scaleY(zone.y)}
              width={zone.w}
              height={scaleY(zone.h)}
              rx="1.2"
              fill={zone.color}
              className="board-zone"
            />
          )}
          <text
            x={zone.x + 1.2}
            y={scaleY(zone.y) + 3.2}
            className="board-zone-label"
          >
            {zone.label}
          </text>
        </g>
      ))}

      {zoneDragPreview ? (
        <rect
          x={zoneDragPreview.x}
          y={scaleY(zoneDragPreview.y)}
          width={zoneDragPreview.w}
          height={scaleY(zoneDragPreview.h)}
          rx="1.2"
          className="board-zone-draft"
          fill="none"
          stroke={color}
          strokeDasharray="1.6 1.2"
          strokeWidth={0.6}
        />
      ) : null}

      {/* Rubber-band del gesto de flecha en curso (W24A): mismo trazo tanto
          en drag real como en el fallback click-click ya armado — pointer-
          events:none (invariante W4, nunca robarle eventos a la cancha). */}
      {arrowGesturePreview ? (
        <g pointerEvents="none" className="board-arrow-draft-group">
          {(() => {
            const start = endpointPoint(arrowGesturePreview.origin, scene.objects);
            const end = arrowGesturePreview.current;
            return (
              <>
                <path
                  d={`M${start.x} ${scaleY(start.y)} L${end.x} ${scaleY(end.y)}`}
                  className={
                    arrowGesturePreview.armed
                      ? "board-arrow-draft armed"
                      : "board-arrow-draft"
                  }
                  fill="none"
                  stroke={color}
                  strokeDasharray="1 1"
                  strokeWidth={0.5}
                />
                <circle
                  cx={start.x}
                  cy={scaleY(start.y)}
                  r={1.1}
                  className="board-arrow-draft-origin"
                  fill={color}
                />
              </>
            );
          })()}
        </g>
      ) : null}

      {visibleArrows.map((arrow) => {
        const start = endpointPoint(arrow.from, scene.objects);
        const end = endpointPoint(arrow.to, scene.objects);
        const style = arrowStyle(arrow.semantic);
        // Override del usuario gana; si no, color por semantica (tabla compartida).
        const stroke = arrow.style?.color ?? style.color;
        const d = style.curved
          ? `M${start.x} ${scaleY(start.y)} Q${(start.x + end.x) / 2} ${scaleY(start.y - 16)} ${end.x} ${scaleY(end.y)}`
          : `M${start.x} ${scaleY(start.y)} L${end.x} ${scaleY(end.y)}`;
        return (
          <g
            key={arrow.id}
            data-board-target
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect({ kind: "arrow", id: arrow.id });
            }}
          >
            <path
              d={d}
              className={`board-arrow ${arrow.semantic}`}
              stroke={stroke}
              strokeWidth={lineWidth * 0.35}
              strokeDasharray={style.dashed ? "1.4 1" : undefined}
              markerEnd="url(#rombo-arrow-head)"
            />
            <EndpointMarker
              x={start.x}
              y={start.y}
              anchored={arrow.from.kind === "object"}
              color={stroke}
            />
            <EndpointMarker
              x={end.x}
              y={end.y}
              anchored={arrow.to.kind === "object"}
              color={stroke}
            />
            {arrow.label ? (
              <text
                x={(start.x + end.x) / 2}
                y={scaleY((start.y + end.y) / 2) - 1.4}
                className="board-arrow-label"
              >
                {arrow.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {consequenceOverlay ? (
        <g className="board-overlay" data-board-overlay>
          {consequenceOverlay.zones.map((zone, index) => (
            <rect
              key={`overlay-zone-${index}`}
              x={zone.x}
              y={scaleY(zone.y)}
              width={zone.w}
              height={scaleY(zone.h)}
              rx="1.2"
              className="board-overlay-zone"
              fill="none"
              stroke="#c7df5f"
              strokeDasharray="1.6 1.2"
              strokeWidth={0.7}
            />
          ))}
          {consequenceOverlay.arrows.map((arrow, index) => {
            const start = endpointPoint(arrow.from, scene.objects);
            const end = endpointPoint(arrow.to, scene.objects);
            return (
              <path
                key={`overlay-arrow-${index}`}
                d={`M${start.x} ${scaleY(start.y)} L${end.x} ${scaleY(end.y)}`}
                className="board-overlay-arrow"
                fill="none"
                stroke="#c7df5f"
                strokeDasharray="1.6 1.2"
                strokeWidth={0.5}
                markerEnd="url(#rombo-arrow-head)"
              />
            );
          })}
          <text x="2" y="4" className="board-overlay-label" fontSize="3">
            Proyección de RomboIQ
          </text>
        </g>
      ) : null}

      {/* Reactive board engine (mc-21): ephemeral read shown only on drop
          (tacticalOverlay is set/cleared in useBoardActions' onCanvasPointerUp,
          never on pointermove). pointer-events:none on both shapes — same
          invariant as .board-overlay-zone/.board-overlay-arrow (W4): this
          must never steal the drag/drag-to-create gestures from the pitch. */}
      {tacticalOverlay ? (
        <g
          className="board-tactical-overlay"
          key={tacticalOverlay.key}
          pointerEvents="none"
        >
          {tacticalOverlay.reads.map((read) =>
            read.kind === "lateralBias" && read.overlaySide ? (
              <rect
                key={read.id}
                x={0}
                y={scaleY(read.overlaySide === "left" ? 0 : 50)}
                width={PITCH_W}
                height={scaleY(50)}
                className="board-tactical-overlay-band"
              />
            ) : read.kind === "blockHeight" && read.overlayX !== undefined ? (
              <line
                key={read.id}
                x1={read.overlayX}
                y1={0}
                x2={read.overlayX}
                y2={PITCH_H}
                className="board-tactical-overlay-line"
              />
            ) : null,
          )}
        </g>
      ) : null}

      {visibleObjects.map((object) => (
        <BoardObjectNode
          key={object.id}
          object={object}
          selected={
            (selected?.kind === "object" && selected.id === object.id) ||
            object.id === anchorOriginId
          }
          onSelect={(id) => onSelect({ kind: "object", id })}
          onPointerDown={(event, id) => {
            event.stopPropagation();
            onPointerDown(pointFromSvgEvent(event), id);
          }}
        />
      ))}
    </svg>
  );
}

// Marca el estado de cada extremo: anclado (halo alrededor del token) vs
// libre (aro hueco flotando en el punto donde cayo). El contraste entre
// extremos es la senal de que el anclaje tomo o no.
//
// FIX audit W24A H3: el anclado se dibujaba como un punto solido r=0.85 en el
// mismo centro que el token — el token (r=2.15, pintado DESPUES en el orden
// del SVG) lo tapaba por completo, asi que "anclado" y "cayo cerca" eran
// indistinguibles a simple vista. Ahora el anclado es un halo SIN relleno de
// radio mayor al del token (r=2.6 > 2.15): la porcion que sobresale del
// circulo del token queda visible como un anillo alrededor de la ficha, sin
// depender del orden de pintado. El aro LIBRE (r=1.5, ya visible porque no
// esta bajo ningun token) sigue siendo la senal del fallo silencioso.
function EndpointMarker({
  x,
  y,
  anchored,
  color,
}: {
  x: number;
  y: number;
  anchored: boolean;
  color: string;
}) {
  return (
    <circle
      cx={x}
      cy={scaleY(y)}
      r={anchored ? 2.6 : 1.5}
      className={`board-endpoint ${anchored ? "anchored" : "free"}`}
      style={{ color }}
    />
  );
}

function BoardObjectNode({
  object,
  selected,
  onSelect,
  onPointerDown,
}: {
  object: BoardObject;
  selected: boolean;
  onSelect: (id: string) => void;
  onPointerDown: (event: PointerEvent<SVGGElement>, id: string) => void;
}) {
  const x = object.position.x;
  const y = scaleY(object.position.y);
  if (object.type === "ball") {
    return (
      <g
        data-board-target
        data-object-id={object.id}
        onPointerDown={(event) => onPointerDown(event, object.id)}
      >
        <circle
          cx={x}
          cy={y}
          r="1.2"
          className={selected ? "ball selected" : "ball"}
        />
      </g>
    );
  }
  if (object.type === "note") {
    return (
      <g
        data-board-target
        data-object-id={object.id}
        onPointerDown={(event) => onPointerDown(event, object.id)}
      >
        <rect
          x={x}
          y={y - 4}
          width="17"
          height="7"
          rx="1.2"
          className={selected ? "note selected" : "note"}
        />
        <text x={x + 1.2} y={y - 1.4} className="note-text">
          {object.label}
        </text>
      </g>
    );
  }
  if (object.type === "equipmentMarker") {
    return (
      <g
        data-board-target
        data-object-id={object.id}
        onPointerDown={(event) => onPointerDown(event, object.id)}
      >
        <rect
          x={x - 1.6}
          y={y - 1.6}
          width="3.2"
          height="3.2"
          rx=".4"
          className={selected ? "equipment selected" : "equipment"}
        />
        <text x={x + 2.2} y={y + 1} className="equipment-label">
          {object.label}
        </text>
      </g>
    );
  }
  const rival = object.type === "opponentToken";
  return (
    <g
      data-board-target
      data-object-id={object.id}
      onPointerDown={(event) => onPointerDown(event, object.id)}
    >
      <circle
        cx={x}
        cy={y}
        r="2.15"
        className={`${rival ? "token rival" : "token own"} ${selected ? "selected" : ""}`}
      />
      <text x={x} y={y + 0.7} className="token-number">
        {object.number ?? ""}
      </text>
      <text x={x} y={y + 4.4} className="token-name">
        {shortName(object.label)}
      </text>
    </g>
  );
}
