import { useState } from "react";
import type { TeamIdentitySetup } from "@/data/teamIdentitySetup";
import { useAppStore } from "@/state/useAppStore";

/**
 * Real Coach Onboarding — a short, skippable guided setup shown only in the
 * real workspace while team identity is not configured (see
 * `isTeamIdentityConfigured`). It writes exclusively through the existing
 * `updateTeamIdentity` action, so the "Coach must not invent identity" rule
 * (enforced in `buildCoachTeamIdentityContext`) stays intact: nothing here
 * bypasses or duplicates that gate.
 *
 * Scope is intentionally small: 5 short steps, plain language, skippable at
 * any point. Skipping (or simply not finishing) leaves the always-visible
 * `TeamSetupPrompt` card as the ongoing reminder that identity is missing —
 * so requirement "#3 Coach must know identity is missing if skipped" is
 * covered without adding new persisted state or touching db.ts/migrations.
 */

const PROBLEM_EXAMPLES = [
  "Nos cuesta salir desde el fondo",
  "Presionamos descoordinados",
  "El equipo queda largo",
  "Nos atacan la espalda de los laterales",
];

type StepIndex = 1 | 2 | 3 | 4 | 5;
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
  const [justCreatedThread, setJustCreatedThread] = useState(false);

  if (hidden) return null;

  function patch(next: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function skip() {
    setHidden(true);
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
      setJustCreatedThread(Boolean(observationId));
    }

    setHidden(true);
  }

  if (justCreatedThread) {
    return (
      <article className="command-summary-card primary onboarding-card">
        <span className="eyebrow">Foco semanal creado</span>
        <h3>Tu primer hilo de la semana ya esta abierto</h3>
        <p>
          Lo vas a ver como hipotesis (evidencia manual, confianza baja) en el
          panel de decision semanal. Se va a fortalecer con observaciones,
          lecturas del Coach o el proximo informe post-partido.
        </p>
      </article>
    );
  }

  if (phase === "intro") {
    return (
      <article className="command-summary-card primary onboarding-card">
        <span className="eyebrow">Primeros pasos</span>
        <h3>Configurar equipo</h3>
        <p>
          Cinco pasos cortos para que el Coach sepa quien sos, como jugas y en
          que estas trabajando esta semana. Podes saltarlo y completarlo
          despues desde el panel de identidad.
        </p>
        <div className="toolbar compact">
          <button type="button" className="btn primary" onClick={() => setPhase(1)}>
            Empezar con mi equipo
          </button>
          <button type="button" className="btn ghost" onClick={skip}>
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
          <span className="eyebrow">Configurar equipo - paso {step} de 5</span>
          <h3>{stepTitle(step)}</h3>
        </div>
        <button type="button" className="btn ghost" onClick={skip}>
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
        <div className="home-team-setup-grid">
          <label>
            <span>Presion</span>
            <input
              value={draft.pressingPreference}
              onChange={(event) => patch({ pressingPreference: event.target.value })}
              placeholder="Como y cuando queres presionar"
            />
          </label>
          <label>
            <span>Altura defensiva</span>
            <select
              value={draft.preferredDefensiveHeight}
              onChange={(event) =>
                patch({
                  preferredDefensiveHeight: event.target.value as TeamIdentitySetup["preferredDefensiveHeight"],
                })
              }
            >
              <option value="">Seleccionar</option>
              <option value="low">Baja</option>
              <option value="mid">Media</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <label>
            <span>Salida</span>
            <input
              value={draft.buildUpPreference}
              onChange={(event) => patch({ buildUpPreference: event.target.value })}
              placeholder="Como queres iniciar la construccion"
            />
          </label>
        </div>
      ) : null}

      {step === 4 ? (
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
            Es opcional, pero si cargas algo el sistema abre tu primer foco
            semanal como hipotesis (evidencia manual, confianza baja) listo
            para validar en la cancha.
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
        </div>
      ) : null}

      {step === 5 ? (
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
              <span>Presion / Altura / Salida</span>
              <b>
                {[draft.pressingPreference, heightSummary(draft.preferredDefensiveHeight), draft.buildUpPreference]
                  .filter((value) => value && value.trim())
                  .join(" - ") || "Sin definir"}
              </b>
            </li>
            <li>
              <span>Problema actual</span>
              <b>{draft.mainCurrentProblem.trim() || "No cargado"}</b>
            </li>
          </ul>
          <p className="muted-panel">
            {draft.mainCurrentProblem.trim()
              ? "Vamos a guardar esta identidad y abrir tu primer foco semanal a partir del problema cargado."
              : "Vamos a guardar esta identidad. Podes cargar el problema actual mas adelante desde la captura del staff."}
          </p>
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
        {step < 5 ? (
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
      return "Quien sos";
    case 2:
      return "Como jugas";
    case 3:
      return "Estilo de juego";
    case 4:
      return "Problema actual";
    case 5:
      return "Confirmar";
    default:
      return "";
  }
}

function heightSummary(value: TeamIdentitySetup["preferredDefensiveHeight"]) {
  if (value === "high") return "altura alta";
  if (value === "mid") return "altura media";
  if (value === "low") return "altura baja";
  return "";
}
