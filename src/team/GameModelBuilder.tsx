import type { GameModel } from "@/data/gameModel";
import { useAppStore } from "@/state/useAppStore";
import { PitchViz } from "@/ui/tacticalPrimitives";

type ListKey =
  | "defensivePrinciples"
  | "offensivePrinciples"
  | "buildUp"
  | "progression"
  | "organizedAttack"
  | "defensiveTransition"
  | "offensiveTransition"
  | "setPieces"
  | "acceptedRisks"
  | "nonNegotiables";

export function GameModelBuilder() {
  const gameModel = useAppStore((state) => state.gameModel);
  const updateGameModel = useAppStore((state) => state.updateGameModel);

  return (
    <section className="team-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Game Model Builder</span>
          <h3>Modelo de juego editable</h3>
        </div>
        <span className="tag-pill">usado por Coach AI</span>
      </div>
      <div className="form-grid two-col" style={{ marginTop: 12 }}>
        <div>
          <PitchViz
            title="Asi quiere jugar este equipo"
            subtitle={`presion ${heightLabel(gameModel.pressing.height)} / bloque ${heightLabel(gameModel.blockHeight)}`}
            overlays={[
              {
                type: "blockHeight",
                x: heightToX(gameModel.blockHeight),
                tone: gameModel.blockHeight === "high" ? "warn" : "info",
                label: "bloque",
              },
              {
                type: "zone",
                x: heightToX(gameModel.pressing.height) - 8,
                y: 14,
                w: 18,
                h: 36,
                tone: "good",
                label: "presion",
              },
            ]}
          />
        </div>
        <label>
          Identidad general
          <textarea
            value={gameModel.identity}
            onChange={(event) =>
              updateGameModel({ identity: event.target.value })
            }
          />
        </label>
        <label>
          Lenguaje del DT
          <textarea
            value={gameModel.coachLanguage}
            onChange={(event) =>
              updateGameModel({ coachLanguage: event.target.value })
            }
          />
        </label>
        <label>
          Altura de presion
          <select
            value={gameModel.pressing.height}
            onChange={(event) =>
              updateGameModel({
                pressing: {
                  ...gameModel.pressing,
                  height: event.target.value as GameModel["pressing"]["height"],
                },
              })
            }
          >
            <option value="high">Alta</option>
            <option value="mid">Media</option>
            <option value="low">Baja</option>
          </select>
        </label>
        <label>
          Altura de bloque
          <select
            value={gameModel.blockHeight}
            onChange={(event) =>
              updateGameModel({
                blockHeight: event.target.value as GameModel["blockHeight"],
              })
            }
          >
            <option value="high">Alta</option>
            <option value="mid">Media</option>
            <option value="low">Baja</option>
          </select>
        </label>
      </div>
      <div className="form-grid two-col" style={{ marginTop: 12 }}>
        <ListEditor title="Principios defensivos" field="defensivePrinciples" />
        <ListEditor title="Principios ofensivos" field="offensivePrinciples" />
        <ListEditor title="Gatillos de presion" field="pressing.triggers" />
        <label>
          Fallback si no llega la presion
          <textarea
            value={gameModel.pressing.fallback}
            onChange={(event) =>
              updateGameModel({
                pressing: {
                  ...gameModel.pressing,
                  fallback: event.target.value,
                },
              })
            }
          />
        </label>
        <ListEditor title="Salida" field="buildUp" />
        <ListEditor title="Progresion" field="progression" />
        <ListEditor title="Ataque organizado" field="organizedAttack" />
        <ListEditor title="Transicion defensiva" field="defensiveTransition" />
        <ListEditor title="Transicion ofensiva" field="offensiveTransition" />
        <ListEditor title="Pelota parada" field="setPieces" />
        <ListEditor title="Riesgos aceptados" field="acceptedRisks" />
        <ListEditor title="No negociables" field="nonNegotiables" />
      </div>
    </section>
  );
}

function ListEditor({
  title,
  field,
}: {
  title: string;
  field: ListKey | "pressing.triggers";
}) {
  const gameModel = useAppStore((state) => state.gameModel);
  const updateGameModel = useAppStore((state) => state.updateGameModel);
  const value =
    field === "pressing.triggers"
      ? gameModel.pressing.triggers
      : gameModel[field];

  return (
    <label>
      {title}
      <textarea
        value={value.join("\n")}
        placeholder="Una idea por linea"
        onChange={(event) => {
          const list = lines(event.target.value);
          if (field === "pressing.triggers") {
            updateGameModel({
              pressing: { ...gameModel.pressing, triggers: list },
            });
          } else {
            updateGameModel({ [field]: list } as Partial<GameModel>);
          }
        }}
      />
    </label>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function heightToX(value: "low" | "mid" | "high") {
  if (value === "high") return 70;
  if (value === "mid") return 50;
  return 32;
}

function heightLabel(value: "low" | "mid" | "high") {
  if (value === "high") return "alta";
  if (value === "mid") return "media";
  return "baja";
}
