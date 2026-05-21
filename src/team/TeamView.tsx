import type { Player } from "@/data";
import { getSelectedPlayer, useAppStore } from "@/state/useAppStore";
import { LineupLab3D } from "./LineupLab3D";

export function TeamView() {
  const team = useAppStore((state) => state.team);
  const selectedPlayer = getSelectedPlayer();

  return (
    <section className="team-rework-layout">
      <LineupLab3D players={team.players} />

      <aside className="team-side-panel">
        <div className="team-card">
          <div className="section-title">
            <h3>Plantel</h3>
            <button
              type="button"
              onClick={() => useAppStore.getState().addPlayer()}
            >
              + Jugador
            </button>
          </div>
          <div className="player-list" style={{ marginTop: 12 }}>
            {team.players.map((player) => (
              <button
                key={player.id}
                type="button"
                className={`player-row player-row-button ${player.id === team.selectedPlayerId ? "active" : ""}`}
                onClick={() =>
                  useAppStore.getState().setSelectedPlayerId(player.id)
                }
              >
                <div className="num">{player.num}</div>
                <div>
                  <b>{player.name}</b>
                  <br />
                  <small>
                    {player.positions.join(" / ")} - {player.profile}
                  </small>
                </div>
                <small>{statusLabel(player.status)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="team-card">
          <h3>Editor de jugador</h3>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <EditableField
              label="Nombre"
              value={selectedPlayer.name}
              onChange={(value) =>
                patchPlayer(selectedPlayer.id, { name: value })
              }
            />
            <EditableField
              label="Dorsal"
              value={String(selectedPlayer.num)}
              onChange={(value) =>
                patchPlayer(selectedPlayer.id, {
                  num: Number(value) || selectedPlayer.num,
                })
              }
            />
            <EditableField
              label="Perfil"
              value={selectedPlayer.profile}
              onChange={(value) =>
                patchPlayer(selectedPlayer.id, { profile: value })
              }
            />
            <label>
              Estado
              <select
                value={selectedPlayer.status}
                onChange={(event) =>
                  patchPlayer(selectedPlayer.id, {
                    status: event.target.value as Player["status"],
                  })
                }
              >
                <option value="available">Disponible</option>
                <option value="doubt">Duda</option>
                <option value="injured">Lesionado</option>
                <option value="suspended">Suspendido</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            {Object.entries(selectedPlayer.attributes).map(([key, value]) => (
              <div className="range-row" key={key}>
                <span>{attributeLabel(key)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(event) =>
                    patchPlayer(selectedPlayer.id, {
                      attributes: {
                        ...selectedPlayer.attributes,
                        [key]: Number(event.target.value),
                      },
                    })
                  }
                />
                <b>{value}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="team-card">
          <h3>Lineups guardados</h3>
          {team.lineups.length ? (
            <div className="lineup-list">
              {team.lineups.map((lineup) => (
                <div className="lineup-item" key={lineup.id}>
                  <b>{lineup.name}</b>
                  <br />
                  <small>
                    {lineup.formation} - {lineup.ownPositions.length} propios
                    {lineup.rivalPositions?.length
                      ? ` - ${lineup.rivalPositions.length} rivales`
                      : ""}
                  </small>
                  <div className="toolbar compact" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        useAppStore.getState().applyLineupToViewer(lineup.id)
                      }
                    >
                      Aplicar al visor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              Todavia no guardaste lineups. Usa el Lab 3D para capturar uno.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function patchPlayer(id: string, patch: Partial<Player>) {
  useAppStore.getState().updatePlayer(id, patch);
}

function statusLabel(status: Player["status"]) {
  const labels: Record<Player["status"], string> = {
    available: "Disponible",
    doubt: "Duda",
    injured: "Lesionado",
    suspended: "Suspendido",
  };
  return labels[status];
}

function attributeLabel(key: string) {
  const labels: Record<string, string> = {
    speed: "Velocidad",
    stamina: "Resistencia",
    pass: "Pase",
    control: "Control",
    press: "Presion",
    duel: "Duelo",
    tactical: "Lectura",
  };
  return labels[key] ?? key;
}
