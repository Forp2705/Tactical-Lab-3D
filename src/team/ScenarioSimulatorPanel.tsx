import { catalog } from "@/data";
import {
  listScenarios,
  simulateScenario,
  type ScenarioId,
} from "@/ai/scenarioSimulator";
import { detectTeamPatterns } from "@/ai/patternDetection";
import { listPostMatchReports } from "@/ai/post-match/postMatchClient";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import { useAppStore } from "@/state/useAppStore";
import { FitChip, PitchViz } from "@/ui/tacticalPrimitives";
import { useEffect, useMemo, useState } from "react";

export function ScenarioSimulatorPanel() {
  const gameModel = useAppStore((state) => state.gameModel);
  const team = useAppStore((state) => state.team);
  const coachShapeContext = useAppStore((state) => state.coachShapeContext);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("raise-block");
  const [objective, setObjective] = useState("Queremos corregir el problema sin romper la identidad.");
  const [reports, setReports] = useState<SavedPostMatchReport[]>([]);

  useEffect(() => {
    let mounted = true;
    listPostMatchReports()
      .then((items) => {
        if (mounted) setReports(items);
      })
      .catch(() => {
        if (mounted) setReports([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const patterns = useMemo(
    () => detectTeamPatterns(reports, { limit: 4 }).map((item) => item.statement),
    [reports],
  );
  const simulation = simulateScenario({
    scenarioId,
    objective,
    currentShapeName: coachShapeContext?.selectedShapeName,
    metrics: coachShapeContext?.currentMetrics,
    gameModel,
    players: team.players,
    evidenceText: reports[0]?.report.executiveSummary,
    patterns,
    exercises: catalog,
  });

  return (
    <section className="team-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Tactical Scenario Simulator</span>
          <h3>Probar la decision antes del sabado</h3>
        </div>
        <span className={`confidence-chip ${simulation.confidence === "low" ? "warn" : simulation.confidence === "high" ? "ok" : "medium"}`}>
          {simulation.confidence} / evidencia {simulation.evidenceLevel}
        </span>
      </div>
      <div className="form-grid two-col" style={{ marginTop: 12 }}>
        <label>
          Escenario
          <select
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value as ScenarioId)}
          >
            {listScenarios().map((scenario) => (
              <option value={scenario.id} key={scenario.id}>
                {scenario.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Objetivo del staff
          <input
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          />
        </label>
      </div>
      <div className="coach-report-grid" style={{ marginTop: 14 }}>
        <PitchViz
          title="Impacto sobre cancha"
          subtitle={simulation.title}
          overlays={scenarioOverlays(scenarioId)}
        />
        <ResultBlock title="Beneficio esperado" value={simulation.expectedBenefit} />
        <ResultBlock title="Riesgo principal" value={simulation.mainRisk} />
        <ResultBlock
          title="Compatibilidad modelo"
          value={compatibilityLabel(simulation.gameModelCompatibility)}
        />
        <ResultList
          title="Ejercicios para testear"
          items={simulation.exercisesToTest.map(
            (exercise) => `${exercise.title}: ${exercise.reason}`,
          )}
        />
        <ChipList title="Jugadores beneficiados" items={simulation.benefitedPlayers} level="strength" />
        <ChipList title="Jugadores expuestos" items={simulation.exposedPlayers} level="risk" />
        <ResultList title="Senales para validar" items={simulation.validationSignals} />
        <ResultList
          title="Fit del plantel"
          items={simulation.fitFindings.map((finding) => finding.statement)}
        />
      </div>
      <div className="coach-report-grid" style={{ marginTop: 14 }}>
        <ResultBlock title="Defensa" value={simulation.lineImpact.defense} />
        <ResultBlock title="Medio" value={simulation.lineImpact.midfield} />
        <ResultBlock title="Ataque" value={simulation.lineImpact.attack} />
      </div>
    </section>
  );
}

function ChipList({
  title,
  items,
  level,
}: {
  title: string;
  items: string[];
  level: "risk" | "warning" | "strength";
}) {
  if (!items.length) return null;
  return (
    <article className="coach-report-card">
      <span className="panel-eyebrow">{title}</span>
      <div className="toolbar compact" style={{ flexWrap: "wrap", marginTop: 10 }}>
        {items.map((item) => (
          <FitChip level={level} key={item}>
            {item}
          </FitChip>
        ))}
      </div>
    </article>
  );
}

function scenarioOverlays(scenarioId: ScenarioId) {
  if (scenarioId === "raise-block" || scenarioId === "high-press") {
    return [
      { type: "blockHeight" as const, x: 70, tone: "warn" as const, label: "bloque alto" },
      { type: "zone" as const, x: 66, y: 12, w: 22, h: 40, tone: "good" as const, label: "recuperar" },
      { type: "zone" as const, x: 18, y: 20, w: 22, h: 24, tone: "danger" as const, label: "espalda" },
    ];
  }
  if (scenarioId === "free-fullback" || scenarioId === "protect-weak-side") {
    return [
      { type: "zone" as const, x: 58, y: 6, w: 28, h: 14, tone: "good" as const, label: "ganar banda" },
      { type: "zone" as const, x: 36, y: 45, w: 26, h: 14, tone: "warn" as const, label: "lado debil" },
    ];
  }
  if (scenarioId === "support-nine" || scenarioId === "direct-play") {
    return [
      { type: "zone" as const, x: 68, y: 22, w: 20, h: 20, tone: "good" as const, label: "9 + apoyos" },
      { type: "line" as const, from: { x: 45, y: 32 }, to: { x: 72, y: 32 }, tone: "info" as const, label: "segunda jugada" },
    ];
  }
  return [
    { type: "zone" as const, x: 35, y: 18, w: 30, h: 28, tone: "info" as const, label: "ajuste" },
  ];
}

function ResultBlock({ title, value }: { title: string; value: string }) {
  return (
    <article className="coach-report-card">
      <span className="panel-eyebrow">{title}</span>
      <p>{value}</p>
    </article>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
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

function compatibilityLabel(value: "aligned" | "conditional" | "contradiction") {
  if (value === "aligned") return "Alineado con el modelo.";
  if (value === "contradiction") return "Contradice el modelo: usar solo como ajuste puntual.";
  return "Compatible con condiciones y evidencia adicional.";
}
