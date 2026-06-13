import { useState } from "react";
import type { TeamIdentitySetup } from "@/data/teamIdentitySetup";
import { useAppStore } from "@/state/useAppStore";

/**
 * Real Coach Onboarding keeps the same safe write path as before:
 * `updateTeamIdentity` for setup and the existing observation -> weekly-thread
 * pipeline for the current problem. This pass only shortens the path to first
 * value; it does not create a new identity or thread source of truth.
 */

const PROBLEM_EXAMPLES = [
  "Nos cuesta salir desde el fondo",
  "Presionamos descoordinados",
  "El equipo queda largo",
  "Nos atacan la espalda de los laterales",
];

type StepIndex = 1 | 2 | 3;
type Phase = "intro" | StepIndex;

type OnboardingDraft = {
  teamName: string;
  squadLevel: string;
  baseFormation: string;
  trainingDays: number;
  pressingPreference: string;
  preferredDefensiveHeight: TeamIdentitySetup["preferredDefensiveHeight"];
  buildUpPreference: string;
  mainCurrentProblem: string;
};

function draftFromIdentity(identity: TeamIdentitySetup): OnboardingDraft {
  return {
    teamName: identity.teamName,
    squadLevel: identity.squadLevel,
    baseFormation: identity.baseFormation,
    trainingDays: identity.trainingDays,
    pressingPreference: identity.pressingPreference,
    preferredDefensiveHeight: identity.preferredDefensiveHeight,
    buildUpPreference: identity.buildUpPreference,
    mainCurrentProblem: "",
  };
}

export function RealCoachOnboarding({ identity }: { identity: TeamIdentitySetup }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFromIdentity(identity));

  if (hidden) return null;

  function patch(next: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function finish() {
    useAppStore.getState().updateTeamIdentity({
      teamName: draft.teamName.trim(),
      squadLevel: draft.squadLevel.trim(),
      baseFormation: draft.baseFormation.trim(),
      trainingDays: draft.trainingDays,
      pressingPreference: draft.pressingPreference.trim(),
      preferredDefensiveHeight: draft.preferredDefensiveHeight,
      buildUpPreference: draft.buildUpPreference.trim(),
    });

    const problem = draft.mainCurrentProblem.trim();
    if (problem) {
      const observationId = useAppStore.getState().addManualObservation({
        text: problem,
        source: "home",
      });
      if (observationId) {
        useAppStore.getState().activateWeeklyThreadFromObservation(observationId);
      }
    }

    setHidden(true);
  }

  if (phase === "intro") {
    return (
      <article className="command-summary-card primary onboarding-card">
        <span className="eyebrow">Primeros pasos</span>
        <h3>Arrancar la semana</h3>
        <p>
          Carga lo minimo para abrir el foco semanal ahora: nombre, categoria,
          dias, sistema base y problema actual. El resto queda para despues.
        </p>
        <div className="toolbar compact">
          <button type="button" className="btn primary" onClick={() => setPhase(1)}>
            Empezar con mi equipo
          </button>
          <button type="button" className="btn ghost" onClick={() => setHidden(true)}>
            Lo hago mas tarde
          </button>
        </div>
      </article>
    );
  }

  const step = phase as StepIndex;

  return (
    <article className="command-summary-card primary onboarding-card">
      <div className="section-title">
        <div>
          <span className="eyebrow">Configurar equipo - paso {step} de 3</span>
          <h3>{stepTitle(step)}</h3>
        </div>
        <button type="button" className="btn ghost" onClick={() => setHidden(true)}>
          Saltar
        </button>
      </div>

      {step === 1 ? (
        <div className="home-team-setup-grid">
          <label>
            <span>Nombre del equipo</span>
            <input
              value={draft.teamName}
              onChange={(event) => patch({ teamName: event.target.value })}
              placeholder="Como se llama tu equipo"
            />
          </label>
          <label>
            <span>Nivel del equipo</span>
            <input
              value={draft.squadLevel}
              onChange={(event) => patch({ squadLevel: event.target.value })}
              placeholder="amateur / semiprofesional / juvenil"
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="home-team-setup-grid">
          <label>
            <span>Sistema base</span>
            <input
              value={draft.baseFormation}
              onChange={(event) => patch({ baseFormation: event.target.value })}
              placeholder="4-3-3 / 4-4-2 / 3-4-2-1"
            />
          </label>
          <label>
            <span>Dias de entrenamiento</span>
            <input
              type="number"
              min={0}
              max={7}
              value={draft.trainingDays || ""}
              onChange={(event) => patch({ trainingDays: Number(event.target.value || 0) })}
              placeholder="0-7"
            />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="onboarding-problem-step">
          <label>
            <span>Problema actual</span>
            <textarea
              className="quick-observation-input"
              value={draft.mainCurrentProblem}
              onChange={(event) => patch({ mainCurrentProblem: event.target.value })}
              placeholder='Ej: "Nos cuesta salir desde el fondo"'
            />
          </label>
          <p className="muted-panel">
            Si lo cargas ahora, el sistema abre tu primer foco semanal como
            hipotesis del staff. Presion, altura, salida e imports quedan para
            despues.
          </p>
          <div className="toolbar compact onboarding-chip-row">
            {PROBLEM_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="chip"
                onClick={() => patch({ mainCurrentProblem: example })}
              >
                {example}
              </button>
            ))}
          </div>
          <div className="onboarding-summary">
            <ul className="onboarding-summary-list">
              <li>
                <span>Equipo</span>
                <b>{draft.teamName.trim() || "Sin definir"}</b>
              </li>
              <li>
                <span>Nivel</span>
                <b>{draft.squadLevel.trim() || "Sin definir"}</b>
              </li>
              <li>
                <span>Sistema</span>
                <b>{draft.baseFormation.trim() || "Sin definir"}</b>
              </li>
              <li>
                <span>Dias de entrenamiento</span>
                <b>{draft.trainingDays || "Sin definir"}</b>
              </li>
              <li>
                <span>Problema actual</span>
                <b>{draft.mainCurrentProblem.trim() || "No cargado"}</b>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      <div className="toolbar compact onboarding-nav">
        {step > 1 ? (
          <button type="button" className="secondary" onClick={() => setPhase((step - 1) as StepIndex)}>
            Atras
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button type="button" className="btn primary" onClick={() => setPhase((step + 1) as StepIndex)}>
            Siguiente
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={finish}>
            {draft.mainCurrentProblem.trim() ? "Crear primer foco semanal" : "Guardar y terminar"}
          </button>
        )}
      </div>
    </article>
  );
}

function stepTitle(step: StepIndex) {
  switch (step) {
    case 1:
      return "Equipo";
    case 2:
      return "Base semanal";
    case 3:
      return "Problema actual";
    default:
      return "";
  }
}
