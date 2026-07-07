import type { DraftPlayer } from "../boardConstants";
import type { PlanningBoardPlayer } from "../productBoardTypes";

type TacticalBoardRosterPanelProps = {
  draft: DraftPlayer;
  editingPlayerId: string | null;
  roster: PlanningBoardPlayer[];
  onDraftChange: (draft: DraftPlayer) => void;
  onSavePlayerDraft: () => void;
  onAssignPlayerToPitch: (player: PlanningBoardPlayer) => void;
  onEditRosterPlayer: (player: PlanningBoardPlayer) => void;
  onDeleteRosterPlayer: (playerId: string) => void;
};

// W15: la seccion Distribucion se elimino — sus botones llamaban la MISMA
// applyOwnFormation que el select del canvas (fuente unica de formacion).
// El plantel vive colapsado por defecto: el editor respira y 1366 entra.
export function TacticalBoardRosterPanel({
  draft,
  editingPlayerId,
  roster,
  onDraftChange,
  onSavePlayerDraft,
  onAssignPlayerToPitch,
  onEditRosterPlayer,
  onDeleteRosterPlayer,
}: TacticalBoardRosterPanelProps) {
  return (
    <section>
      <details className="rombo-roster-collapse">
        <summary>Mi equipo / Plantel · {roster.length}</summary>
        <div className="rombo-player-form">
          <input
            placeholder="Nombre"
            value={draft.name}
            onChange={(event) =>
              onDraftChange({ ...draft, name: event.target.value })
            }
          />
          <input
            placeholder="Puesto"
            value={draft.position}
            onChange={(event) =>
              onDraftChange({ ...draft, position: event.target.value })
            }
          />
          <input
            placeholder="Numero"
            value={draft.number}
            onChange={(event) =>
              onDraftChange({ ...draft, number: event.target.value })
            }
          />
          <textarea
            placeholder="Rasgos / caracteristicas"
            value={draft.traits}
            onChange={(event) =>
              onDraftChange({ ...draft, traits: event.target.value })
            }
          />
          <button type="button" onClick={onSavePlayerDraft}>
            {editingPlayerId ? "Guardar jugador" : "Agregar jugador"}
          </button>
        </div>
        <div className="rombo-roster-list">
          {roster.map((player) => (
            <article key={player.id}>
              <button
                type="button"
                onClick={() => onAssignPlayerToPitch(player)}
              >
                Agregar a cancha
              </button>
              <strong>
                {player.number} - {player.name}
              </strong>
              <span>{player.position}</span>
              <div>
                <button
                  type="button"
                  onClick={() => onEditRosterPlayer(player)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRosterPlayer(player.id)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
