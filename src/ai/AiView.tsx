import { generateAiPlan } from "@/ai/geminiClient";
import { withGuardrails } from "@/ai/guardrails";
import type { AiPlan } from "@/ai/outputSchemas";
import { catalog } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import { useState } from "react";

export function AiView() {
  const prompt = useAppStore((state) => state.aiPrompt);
  const team = useAppStore((state) => state.team);
  const session = useAppStore((state) => state.session);
  const microcycle = useAppStore((state) => state.microcycle);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const selectedExercise =
    catalog.find((exercise) => exercise.id === selectedExerciseId) ??
    catalog[0];
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(mode: AiPlan["mode"]) {
    setLoading(true);
    const next = await generateAiPlan(mode, {
      teamName: team.name,
      model: team.model,
      selectedExercise,
      players: team.players,
      session,
      microcycle,
      prompt,
    });
    setPlan(withGuardrails(next));
    setLoading(false);
  }

  const current =
    plan ??
    withGuardrails({
      mode: "query",
      assumptions: [
        "Equipo amateur/semi-pro",
        "Consulta local",
        "Gemini sin ejecutar todavia",
      ],
      confidence: 0.6,
      planA:
        "Escribi una consulta tactica y elegi Consulta, Critica o Plan de partido.",
      planB:
        "Cuanto mas contexto de rival, sistema y problema incluyas, mejor va a responder.",
      abpSuggestions: [],
      risks: ["Respuesta generica si falta contexto"],
      why: [
        "El asistente esta pensado para razonar con contexto, no para tirar recetas",
      ],
      checklist: [
        "Describir el problema",
        "Indicar sistema propio",
        "Indicar sistema rival",
      ],
      linkedExercises: [],
    });
  const labels = labelsForMode(current.mode);

  return (
    <section className="ai-layout">
      <div className="team-card">
        <h3>Asistente tactico con Gemini</h3>
        <textarea
          placeholder="Ej: Tenemos 16 jugadores, queremos presion tras perdida y salida por banda..."
          value={prompt}
          onChange={(event) =>
            useAppStore.getState().setAiPrompt(event.target.value)
          }
          style={{ width: "100%", minHeight: 180, marginTop: 12 }}
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => void run("query")}>
            {loading ? "Generando..." : "Consultar"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void run("critic")}
          >
            Modo critica
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void run("match")}
          >
            Plan de partido
          </button>
        </div>
      </div>
      <div className="team-card ai-output" id="aiOutput">
        <h3>Salida estructurada</h3>
        <p className="muted-panel">
          La salida usa Gemini por proxy local server-side. Si falta la key o
          falla la API, cae a fallback local validado.
        </p>
        <div className="ai-card">
          <b>Ejercicio actual</b>
          <p>{selectedExercise.title}</p>
        </div>
        <div className="ai-card">
          <b>Supuestos</b>
          <ul>
            {current.assumptions.map((item, index) => (
              <li key={`assumption-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="ai-card">
          <b>{labels.planA}</b>
          <p>{current.planA}</p>
        </div>
        <div className="ai-card">
          <b>{labels.planB}</b>
          <p>{current.planB}</p>
        </div>
        {current.planC ? (
          <div className="ai-card">
            <b>{labels.planC}</b>
            <p>{current.planC}</p>
          </div>
        ) : null}
        {current.abpSuggestions.length ? (
          <div className="ai-card">
            <b>ABP</b>
            <ul>
              {current.abpSuggestions.map((item, index) => (
                <li key={`abp-${index}-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="ai-card">
          <b>Riesgos</b>
          <ul>
            {current.risks.map((item, index) => (
              <li key={`risk-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="ai-card">
          <b>Por que</b>
          <ul>
            {current.why.map((item, index) => (
              <li key={`why-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="ai-card">
          <b>Checklist</b>
          <ul>
            {current.checklist.map((item, index) => (
              <li key={`checklist-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
        {current.linkedExercises.length ? (
          <div className="ai-card">
            <b>Ejercicios vinculados</b>
            <p>{current.linkedExercises.join(", ")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function labelsForMode(mode: AiPlan["mode"]) {
  if (mode === "query") {
    return {
      planA: "Respuesta",
      planB: "Alternativa",
      planC: "Matiz",
    };
  }

  if (mode === "critic") {
    return {
      planA: "Lectura critica",
      planB: "Mitigacion",
      planC: "Escenario alternativo",
    };
  }

  return {
    planA: "Plan A",
    planB: "Plan B",
    planC: "Plan C",
  };
}
