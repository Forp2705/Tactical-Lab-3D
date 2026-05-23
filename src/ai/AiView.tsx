import type { CoachMatchAdvice } from "@/ai/CoachSchemas";
import { requestCoachAgent } from "@/ai/coachAgentClient";
import { PostMatchAnalysisView } from "@/ai/post-match/PostMatchAnalysisView";
import { useAppStore } from "@/state/useAppStore";
import { useState } from "react";

export function AiView() {
  const prompt = useAppStore((state) => state.aiPrompt);
  const [mode, setMode] = useState<"coach" | "postMatch">("coach");
  const [advice, setAdvice] = useState<CoachMatchAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const input = prompt.trim();

  async function runCoachAgent() {
    if (!input || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await requestCoachAgent(input);
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
        <span className="panel-eyebrow">Coach Agent</span>
        <h3>Asistente tactico</h3>
        <textarea
          placeholder="Describi el problema tactico, contexto del partido, sistema propio, rival o comportamiento que queres analizar."
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
          La consulta se ejecuta por el endpoint server-side{" "}
          <code>/api/coach-agent</code>. La API key de OpenRouter queda fuera
          del frontend.
        </p>

        {advice ? <AdviceResult advice={advice} /> : <EmptyState />}
        </div>
      </section>
    </>
  );
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
        Escribi una consulta tactica y ejecuta el agente para ver la salida
        validada.
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
