import type {
  BoardArrow,
  BoardObject,
  BoardZone,
  BoardZoneSemantic,
} from "../boardModel";

type ZonePatch = Partial<{
  label: string;
  tacticalMeaning: string;
  semantic: BoardZoneSemantic;
  color: string;
}>;

type TacticalBoardInspectorPanelProps = {
  selectedObject: BoardObject | null;
  selectedArrow: BoardArrow | null;
  selectedZone: BoardZone | null;
  onUpdateObject: (patch: Partial<BoardObject>) => void;
  onUpdateArrow: (patch: Partial<BoardArrow>) => void;
  onUpdateZone: (patch: ZonePatch) => void;
};

export function TacticalBoardInspectorPanel({
  selectedObject,
  selectedArrow,
  selectedZone,
  onUpdateObject,
  onUpdateArrow,
  onUpdateZone,
}: TacticalBoardInspectorPanelProps) {
  return (
    <section>
      <h2>Jugador / Inspector</h2>
      {selectedObject ? (
        <div className="rombo-inspector">
          <input
            value={selectedObject.label}
            onChange={(event) => onUpdateObject({ label: event.target.value })}
          />
          <input
            value={selectedObject.role ?? ""}
            placeholder="Rol tactico"
            onChange={(event) => onUpdateObject({ role: event.target.value })}
          />
          <textarea
            value={selectedObject.note ?? ""}
            placeholder="Tarea / rasgos"
            onChange={(event) => onUpdateObject({ note: event.target.value })}
          />
          <span>
            Equipo: {selectedObject.type === "opponentToken" ? "B" : "A"}
          </span>
        </div>
      ) : selectedArrow ? (
        <div className="rombo-inspector">
          <input
            value={selectedArrow.label ?? ""}
            placeholder="Etiqueta"
            onChange={(event) => onUpdateArrow({ label: event.target.value })}
          />
          <textarea
            value={selectedArrow.tacticalMeaning ?? ""}
            placeholder="Intencion tactica"
            onChange={(event) =>
              onUpdateArrow({ tacticalMeaning: event.target.value })
            }
          />
        </div>
      ) : selectedZone ? (
        <div className="rombo-inspector">
          <input
            value={selectedZone.label}
            onChange={(event) => onUpdateZone({ label: event.target.value })}
          />
          <textarea
            value={selectedZone.tacticalMeaning ?? ""}
            placeholder="Intencion de zona"
            onChange={(event) =>
              onUpdateZone({ tacticalMeaning: event.target.value })
            }
          />
        </div>
      ) : (
        <p>Selecciona una ficha, flecha, zona o nota para editar.</p>
      )}
    </section>
  );
}
