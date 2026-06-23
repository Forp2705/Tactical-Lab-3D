import { type DraftPlayer, FORMATIONS } from "../boardConstants";
import type { PlanningBoardPlayer } from "../productBoardTypes";

type TacticalBoardRosterPanelProps = {
  teamAFormation: string;
  draft: DraftPlayer;
  editingPlayerId: string | null;
  roster: PlanningBoardPlayer[];
  onApplyOwnFormation: (formation: string) => void;
  onDraftChange: (draft: DraftPlayer) => void;
  onSavePlayerDraft: () => void;
  onAssignPlayerToPitch: (player: PlanningBoardPlayer) => void;
  onEditRosterPlayer: (player: PlanningBoardPlayer) => void;
  onDeleteRosterPlayer: (playerId: string) => void;
};

export function TacticalBoardRosterPanel({
  teamAFormation,
  draft,
  editingPlayerId,
  roster,
  onApplyOwnFormation,
  onDraftChange,
  onSavePlayerDraft,
  onAssignPlayerToPitch,
  onEditRosterPlayer,
  onDeleteRosterPlayer,
}: TacticalBoardRosterPanelProps) {
  return (
    <>
      <section>
        <h2>Distribucion</h2>
        <div className="rombo-formation-grid">
          {FORMATIONS.map((formation) => (
            <button
              type="button"
              key={formation}
              className={teamAFormation === formation ? "active" : ""}
              onClick={() => onApplyOwnFormation(formation)}
            >
              {formation}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Mi equipo / Plantel</h2>
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
      </section>
    </>
  );
}
