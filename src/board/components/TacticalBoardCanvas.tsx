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
import type { BoardObject, BoardPoint, BoardScene } from "../boardModel";
import type { ConsequenceOverlay } from "../scenarioBoardConsequence";

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
  // Proyeccion efimera de RomboIQ (preview); su geometria es identica a la que
  // se commitea al aceptar — solo cambia el estilo (ghost/punteado) para senalar
  // que todavia no es parte de la escena.
  consequenceOverlay: ConsequenceOverlay | null;
  keyInstructions: {
    objective: string;
    rule: string;
    successCondition: string;
  };
  onSelect: (selection: Selection) => void;
  onPointerDown: (point: BoardPoint, targetId?: string) => void;
  onPointerMove: (point: BoardPoint) => void;
  onPointerUp: () => void;
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
  consequenceOverlay,
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
        consequenceOverlay={consequenceOverlay}
        onSelect={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="rombo-key-instructions">
        <strong>Instrucciones clave</strong>
        <ul>
          <li>{keyInstructions.objective}</li>
          <li>{keyInstructions.rule}</li>
          <li>{keyInstructions.successCondition}</li>
        </ul>
      </div>
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
  consequenceOverlay,
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
  consequenceOverlay: ConsequenceOverlay | null;
  onSelect: (selection: Selection) => void;
  onPointerDown: (point: BoardPoint, targetId?: string) => void;
  onPointerMove: (point: BoardPoint) => void;
  onPointerUp: () => void;
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
      onPointerUp={onPointerUp}
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
              cy={zone.y + zone.h / 2}
              rx={zone.w / 2}
              ry={zone.h / 2}
              fill={zone.color}
              className="board-zone"
            />
          ) : (
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx="1.2"
              fill={zone.color}
              className="board-zone"
            />
          )}
          <text x={zone.x + 1.2} y={zone.y + 3.2} className="board-zone-label">
            {zone.label}
          </text>
        </g>
      ))}

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
              y={zone.y}
              width={zone.w}
              height={zone.h}
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

// Marca el estado de cada extremo: anclado (punto fijo) vs libre (aro hueco).
// El contraste entre extremos es la senal de que el anclaje tomo o no. La
// forma (relleno vs hueco) la define el CSS via .anchored/.free; el color sale
// de la tabla arrowStyle (inline `color` -> currentColor en CSS).
//
// Asimetria deliberada de tamano: el dot anclado vive en el centro del token y
// el token (r=2.15) se pinta encima, asi que casi siempre queda tapado en uso
// real -> no necesita prominencia (la linea entrando limpia al token ya es la
// pista del exito). El aro LIBRE es la senal del fallo silencioso: cuando
// quisiste anclar y erraste, ese aro queda flotando al lado del token. Tiene
// que saltar a la vista, asi que va mas grande que el anclado.
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
      r={anchored ? 0.85 : 1.5}
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
