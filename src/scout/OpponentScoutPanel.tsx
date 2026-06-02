import type { OpponentScout } from "@/scout/opponentScout";
import { buildOpponentGamePlan } from "@/scout/opponentScout";
import { useAppStore } from "@/state/useAppStore";
import { PitchViz } from "@/ui/tacticalPrimitives";

type ListField = "strengths" | "vulnerabilities" | "keyPlayers" | "risks";

export function OpponentScoutPanel() {
  const scout = useAppStore((state) => state.opponentScout);
  const gameModel = useAppStore((state) => state.gameModel);
  const updateOpponentScout = useAppStore(
    (state) => state.updateOpponentScout,
  );
  const plan = buildOpponentGamePlan(scout, gameModel);

  return (
    <section className="team-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Opponent Scout Lite</span>
          <h3>Rival a plan de partido</h3>
        </div>
        <span className="tag-pill">contexto Coach</span>
      </div>
      <div className="form-grid two-col" style={{ marginTop: 12 }}>
        <label>
          Rival
          <input
            value={scout.rival}
            onChange={(event) =>
              updateOpponentScout({ rival: event.target.value })
            }
          />
        </label>
        <label>
          Sistema probable
          <input
            value={scout.probableSystem}
            onChange={(event) =>
              updateOpponentScout({ probableSystem: event.target.value })
            }
          />
        </label>
        <TextField field="pressing" label="Presion" />
        <TextField field="buildUp" label="Salida" />
        <TextField field="setPieces" label="Pelota parada" />
        <TextField field="rhythm" label="Ritmo" />
        <ListField title="Puntos fuertes" field="strengths" />
        <ListField title="Vulnerabilidades" field="vulnerabilities" />
        <ListField title="Jugadores clave" field="keyPlayers" />
        <ListField title="Riesgos" field="risks" />
        <label style={{ gridColumn: "1 / -1" }}>
          Notas libres
          <textarea
            value={scout.notes}
            onChange={(event) =>
              updateOpponentScout({ notes: event.target.value })
            }
          />
        </label>
      </div>
      <div className="coach-report-grid" style={{ marginTop: 14 }}>
        <PitchViz
          title="Plan de partido visual"
          subtitle={scout.rival}
          overlays={[
            {
              type: "zone",
              x: 62,
              y: 8,
              w: 26,
              h: 18,
              tone: scout.vulnerabilities.length ? "good" : "info",
              label: "atacar",
            },
            {
              type: "zone",
              x: 22,
              y: 38,
              w: 26,
              h: 18,
              tone: scout.strengths.length ? "warn" : "info",
              label: "proteger",
            },
            {
              type: "blockHeight",
              x: scout.pressing.toLowerCase().includes("alta") ? 68 : 50,
              tone: "warn",
              label: "presion rival",
            },
          ]}
        />
        <PlanList title="Plan base" items={plan.plan} />
        <PlanList title="Como atacarlo" items={plan.attackIt} />
        <PlanList title="Como defenderlo" items={plan.defendIt} />
        <PlanList title="Foco semanal" items={plan.weeklyTrainingFocus} />
        <PlanList title="Preguntas pendientes" items={plan.openQuestions} />
        <PlanList title="Alertas partido" items={plan.matchAlerts} />
      </div>
    </section>
  );
}

function TextField({
  field,
  label,
}: {
  field: keyof Pick<
    OpponentScout,
    "pressing" | "buildUp" | "setPieces" | "rhythm"
  >;
  label: string;
}) {
  const scout = useAppStore((state) => state.opponentScout);
  const updateOpponentScout = useAppStore(
    (state) => state.updateOpponentScout,
  );
  return (
    <label>
      {label}
      <textarea
        value={scout[field]}
        onChange={(event) =>
          updateOpponentScout({ [field]: event.target.value })
        }
      />
    </label>
  );
}

function ListField({ title, field }: { title: string; field: ListField }) {
  const scout = useAppStore((state) => state.opponentScout);
  const updateOpponentScout = useAppStore(
    (state) => state.updateOpponentScout,
  );
  return (
    <label>
      {title}
      <textarea
        value={scout[field].join("\n")}
        placeholder="Uno por linea"
        onChange={(event) =>
          updateOpponentScout({ [field]: lines(event.target.value) })
        }
      />
    </label>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <article className="coach-report-card">
      <span className="panel-eyebrow">{title}</span>
      <ul>
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
