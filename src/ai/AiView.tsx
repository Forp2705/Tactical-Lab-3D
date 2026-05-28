import type { CoachMatchAdvice } from "@/ai/CoachSchemas";
import {
  requestCoachAgent,
  type CoachAgentRuntimeContext,
} from "@/ai/coachAgentClient";
import { PostMatchAnalysisView } from "@/ai/post-match/PostMatchAnalysisView";
import type { Player } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import { useState } from "react";

export function AiView() {
  const prompt = useAppStore((state) => state.aiPrompt);
  const coachShapeContext = useAppStore((state) => state.coachShapeContext);
  const team = useAppStore((state) => state.team);
  const [mode, setMode] = useState<"coach" | "postMatch">("coach");
  const [advice, setAdvice] = useState<CoachMatchAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const input = prompt.trim();

  async function runCoachAgent() {
    if (!input || loading) return;
    const coachContext = buildCoachRuntimeContext(team, coachShapeContext);

    setLoading(true);
    setError(null);

    try {
      const response = await requestCoachAgent(input, coachContext);
      setAdvice(response);
    } catch (requestError) {
      setAdvice(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo consultar el agente tactico.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (mode === "postMatch") {
    return (
      <>
        <AiModeTabs mode={mode} setMode={setMode} />
        <PostMatchAnalysisView />
      </>
    );
  }

  return (
    <>
      <AiModeTabs mode={mode} setMode={setMode} />
      <section className="ai-layout">
        <div className="team-card">
          <span className="panel-eyebrow">Agente tactico</span>
          <h3>Consulta contextual</h3>
          <textarea
            placeholder="Describi el problema tactico, el contexto del partido, el sistema propio, el rival o el comportamiento que queres analizar."
            value={prompt}
            onChange={(event) =>
              useAppStore.getState().setAiPrompt(event.target.value)
            }
            style={{ width: "100%", minHeight: 180, marginTop: 12 }}
          />
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button
              type="button"
              disabled={!input || loading}
              onClick={() => void runCoachAgent()}
            >
              {loading ? "Analizando..." : "Consultar agente"}
            </button>
          </div>
          {error ? (
            <div className="ai-card" role="alert" style={{ marginTop: 16 }}>
              <b>Error</b>
              <p>{error}</p>
            </div>
          ) : null}
        </div>

        <div className="team-card ai-output" id="aiOutput">
          <span className="panel-eyebrow">Salida estructurada</span>
          <h3>Respuesta del agente</h3>
          <p className="muted-panel">
            La consulta usa el endpoint server-side{" "}
            <code>/api/coach-agent</code>. La clave de OpenRouter no se expone
            al frontend.
          </p>

          {advice ? <AdviceResult advice={advice} /> : <EmptyState />}
        </div>
      </section>
    </>
  );
}

function buildCoachRuntimeContext(
  team: ReturnType<typeof useAppStore.getState>["team"],
  coachShapeContext: ReturnType<typeof useAppStore.getState>["coachShapeContext"],
): CoachAgentRuntimeContext {
  const toPlayer = (player: Player) => ({
    name: player.name,
    num: player.num,
    positions: player.positions,
    status: player.status,
    profile: player.profile,
    attributes: {
      speed: player.attributes.speed,
      pass: player.attributes.pass,
      tactical: player.attributes.tactical,
      duel: player.attributes.duel,
    },
  });

  return {
    shapeContext: coachShapeContext,
    teamModel: team.model,
    availableSquad: team.players
      .filter((player) => player.status === "available")
      .map(toPlayer),
    unavailableSquad: team.players
      .filter((player) => player.status !== "available")
      .map(toPlayer),
  };
}

function AiModeTabs({
  mode,
  setMode,
}: {
  mode: "coach" | "postMatch";
  setMode: (mode: "coach" | "postMatch") => void;
}) {
  return (
    <div className="segmented ai-mode-tabs" style={{ marginBottom: 14 }}>
      <button
        type="button"
        className={mode === "coach" ? "active" : ""}
        onClick={() => setMode("coach")}
      >
        Consulta tactica
      </button>
      <button
        type="button"
        className={mode === "postMatch" ? "active" : ""}
        onClick={() => setMode("postMatch")}
      >
        Post partido
      </button>
    </div>
  );
}

function AdviceResult({ advice }: { advice: CoachMatchAdvice }) {
  return (
    <>
      <TextCard title="Lectura tactica" value={advice.tacticalReading} />
      <TextCard title="Causa probable" value={advice.probableCause} />
      <TextCard title="Ajuste principal" value={advice.mainAdjustment} />
      <ListCard
        title="Instrucciones de campo"
        items={advice.onFieldInstructions}
      />
      <TextCard title="Test del miercoles" value={advice.wednesdayTest} />
      <TextCard title="Foco del sabado" value={advice.saturdayFocus} />
      <ListCard title="Riesgos del ajuste" items={advice.adjustmentRisks} />
      <ListCard title="Senales de exito" items={advice.successSignals} />
      <div className="ai-card">
        <b>Reflexion</b>
        <dl className="ai-reflection">
          <div>
            <dt>Incertidumbre principal</dt>
            <dd>{advice.reflection.mainUncertainty}</dd>
          </div>
          <div>
            <dt>Informacion faltante</dt>
            <dd>{advice.reflection.missingInformation}</dd>
          </div>
          <div>
            <dt>Interpretacion alternativa</dt>
            <dd>{advice.reflection.alternativeInterpretation}</dd>
          </div>
          <div>
            <dt>Confianza</dt>
            <dd>{Math.round(advice.reflection.confidence * 100)}%</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="ai-card">
      <b>Sin respuesta todavia</b>
      <p>
        Usa "Consulta tactica" para una lectura puntual o cambia a "Post
        partido" para cargar contexto, notas y tags del partido.
      </p>
    </div>
  );
}

function TextCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="ai-card">
      <b>{title}</b>
      <p>{value}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="ai-card">
      <b>{title}</b>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
