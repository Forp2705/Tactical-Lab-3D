import {
  type BoardArrow,
  type BoardArrowSemantic,
  BoardArrowSemanticSchema,
  type BoardObject,
  type BoardPhaseType,
  BoardPhaseTypeSchema,
  type BoardZone,
  type BoardZoneSemantic,
  BoardZoneSemanticSchema,
  labelForArrow,
  labelForZone,
} from "../boardModel";

type InspectorZone = { id: string; label: string };

type ZonePatch = Partial<{
  label: string;
  tacticalMeaning: string;
}>;

type TacticalBoardInspectorPanelProps = {
  selectedObject: BoardObject | null;
  selectedArrow: BoardArrow | null;
  selectedZone: BoardZone | null;
  zones: InspectorZone[];
  sceneSummary: { title: string; phase: string; problem: string };
  onUpdateObject: (patch: Partial<BoardObject>) => void;
  onUpdateArrow: (patch: Partial<BoardArrow>) => void;
  onUpdateZone: (patch: ZonePatch) => void;
  onSetArrowSemantic: (semantic: BoardArrowSemantic) => void;
  onSetArrowTargetZone: (zoneId: string | null) => void;
  onSetZoneSemantic: (semantic: BoardZoneSemantic) => void;
  onDelete: () => void;
};

export function TacticalBoardInspectorPanel({
  selectedObject,
  selectedArrow,
  selectedZone,
  zones,
  sceneSummary,
  onUpdateObject,
  onUpdateArrow,
  onUpdateZone,
  onSetArrowSemantic,
  onSetArrowTargetZone,
  onSetZoneSemantic,
  onDelete,
}: TacticalBoardInspectorPanelProps) {
  return (
    <section className="rombo-inspector-panel">
      <h2>Inspector</h2>
      {selectedObject ? (
        <ObjectInspector
          object={selectedObject}
          onUpdate={onUpdateObject}
          onDelete={onDelete}
        />
      ) : selectedArrow ? (
        <ArrowInspector
          arrow={selectedArrow}
          zones={zones}
          onUpdate={onUpdateArrow}
          onSetSemantic={onSetArrowSemantic}
          onSetTargetZone={onSetArrowTargetZone}
          onDelete={onDelete}
        />
      ) : selectedZone ? (
        <ZoneInspector
          zone={selectedZone}
          onUpdate={onUpdateZone}
          onSetSemantic={onSetZoneSemantic}
          onDelete={onDelete}
        />
      ) : (
        <SceneSummary summary={sceneSummary} />
      )}
    </section>
  );
}

function ObjectInspector({
  object,
  onUpdate,
  onDelete,
}: {
  object: BoardObject;
  onUpdate: (patch: Partial<BoardObject>) => void;
  onDelete: () => void;
}) {
  const isRival = object.type === "opponentToken";
  return (
    <div className="rombo-inspector">
      <span className="rombo-inspector-kind">
        {isRival ? "Rival" : "Jugador propio"}
      </span>
      <label>
        Nombre
        <input
          value={object.label}
          onChange={(event) => onUpdate({ label: event.target.value })}
        />
      </label>
      <label>
        Numero
        <input
          type="number"
          min={1}
          max={99}
          value={object.number ?? ""}
          onChange={(event) =>
            onUpdate({ number: Number(event.target.value) || undefined })
          }
        />
      </label>
      <label>
        Rol
        <input
          value={object.role ?? ""}
          placeholder="Rol tactico"
          onChange={(event) => onUpdate({ role: event.target.value })}
        />
      </label>
      <label>
        Tarea / rasgos
        <textarea
          value={object.note ?? ""}
          onChange={(event) => onUpdate({ note: event.target.value })}
        />
      </label>
      <button type="button" className="danger" onClick={onDelete}>
        Borrar ficha
      </button>
    </div>
  );
}

function ArrowInspector({
  arrow,
  zones,
  onUpdate,
  onSetSemantic,
  onSetTargetZone,
  onDelete,
}: {
  arrow: BoardArrow;
  zones: InspectorZone[];
  onUpdate: (patch: Partial<BoardArrow>) => void;
  onSetSemantic: (semantic: BoardArrowSemantic) => void;
  onSetTargetZone: (zoneId: string | null) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rombo-inspector">
      <span className="rombo-inspector-kind">Accion</span>
      <label>
        Tipo
        <select
          value={arrow.semantic}
          onChange={(event) =>
            onSetSemantic(event.target.value as BoardArrowSemantic)
          }
        >
          {BoardArrowSemanticSchema.options.map((semantic) => (
            <option key={semantic} value={semantic}>
              {labelForArrow(semantic)}
            </option>
          ))}
        </select>
      </label>
      <div className="rombo-inspector-readonly">
        <span>Origen</span>
        <b>
          {arrow.from.kind === "object" ? "Jugador (anclado)" : "Punto libre"}
        </b>
      </div>
      <div className="rombo-inspector-readonly">
        <span>Destino</span>
        <b>{describeDestination(arrow, zones)}</b>
      </div>
      <label>
        Zona objetivo
        <select
          value={arrow.targetZoneId ?? ""}
          onChange={(event) => onSetTargetZone(event.target.value || null)}
        >
          <option value="">Ninguna</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Intencion
        <input
          value={arrow.intent ?? ""}
          placeholder="Que busca esta accion"
          onChange={(event) => onUpdate({ intent: event.target.value })}
        />
      </label>
      <label>
        Etiqueta
        <input
          value={arrow.label ?? ""}
          onChange={(event) => onUpdate({ label: event.target.value })}
        />
      </label>
      <label>
        Fase
        <select
          value={arrow.linkedPhase ?? ""}
          onChange={(event) =>
            onUpdate({
              linkedPhase: (event.target.value as BoardPhaseType) || undefined,
            })
          }
        >
          <option value="">Sin fase</option>
          {BoardPhaseTypeSchema.options.map((phase) => (
            <option key={phase} value={phase}>
              {phase}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="danger" onClick={onDelete}>
        Borrar accion
      </button>
    </div>
  );
}

function ZoneInspector({
  zone,
  onUpdate,
  onSetSemantic,
  onDelete,
}: {
  zone: BoardZone;
  onUpdate: (patch: ZonePatch) => void;
  onSetSemantic: (semantic: BoardZoneSemantic) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rombo-inspector">
      <span className="rombo-inspector-kind">Zona</span>
      <label>
        Tipo
        <select
          value={zone.semantic}
          onChange={(event) =>
            onSetSemantic(event.target.value as BoardZoneSemantic)
          }
        >
          {BoardZoneSemanticSchema.options.map((semantic) => (
            <option key={semantic} value={semantic}>
              {labelForZone(semantic)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Etiqueta
        <input
          value={zone.label}
          onChange={(event) => onUpdate({ label: event.target.value })}
        />
      </label>
      <label>
        Intencion
        <textarea
          value={zone.tacticalMeaning ?? ""}
          onChange={(event) =>
            onUpdate({ tacticalMeaning: event.target.value })
          }
        />
      </label>
      <button type="button" className="danger" onClick={onDelete}>
        Borrar zona
      </button>
    </div>
  );
}

function SceneSummary({
  summary,
}: {
  summary: { title: string; phase: string; problem: string };
}) {
  return (
    <div className="rombo-inspector rombo-inspector-summary">
      <div className="rombo-inspector-readonly">
        <span>Escena</span>
        <b>{summary.title}</b>
      </div>
      <div className="rombo-inspector-readonly">
        <span>Fase</span>
        <b>{summary.phase}</b>
      </div>
      <div className="rombo-inspector-readonly">
        <span>Problema</span>
        <b>{summary.problem || "Sin problema definido"}</b>
      </div>
      <p className="muted-panel">
        Selecciona una ficha, accion o zona para editarla.
      </p>
    </div>
  );
}

function describeDestination(arrow: BoardArrow, zones: InspectorZone[]) {
  if (arrow.targetZoneId) {
    const zone = zones.find((item) => item.id === arrow.targetZoneId);
    return `Zona: ${zone?.label ?? "(zona eliminada)"}`;
  }
  if (arrow.to.kind === "object") return "Jugador (anclado)";
  return "Punto libre";
}
