import { beforeEach, describe, expect, it } from "vitest";
import {
  criticalExerciseIds,
  getSelectableCatalog,
} from "../src/data/exercises/validatedCatalog";
import {
  buildSessionPlanFromProblemTemplate,
  materializeDiagnosisSession,
} from "../src/sessions/diagnosisSession";
import {
  PROBLEM_TEMPLATES,
  getProblemTemplate,
} from "../src/sessions/problemTemplates";
import { useAppStore } from "../src/state/useAppStore";

const exercises = getSelectableCatalog();

function baseSession() {
  return useAppStore.getInitialState().session;
}

describe("Quick Start problem templates", () => {
  it("exposes exactly the five curated templates with unique ids", () => {
    expect(PROBLEM_TEMPLATES).toHaveLength(5);
    const ids = PROBLEM_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(5);
  });

  // Invariante duro por construccion: estas propiedades no deberian romperse
  // nunca, independientemente de como cambie el catalogo.
  it.each(PROBLEM_TEMPLATES)(
    "produces a deterministic, selectable, non-empty session for '$id'",
    (template) => {
      const planA = buildSessionPlanFromProblemTemplate(template, exercises);
      const planB = buildSessionPlanFromProblemTemplate(template, exercises);
      // Deterministico: mismas IDs en cada llamada (sin LLM, sin azar).
      expect(planA.exerciseIds).toEqual(planB.exerciseIds);
      // Sincrono: no devuelve una promesa => no hay endpoint IA en el camino.
      expect(planA).not.toBeInstanceOf(Promise);

      const session = materializeDiagnosisSession(
        baseSession(),
        planA,
        exercises,
      );
      expect(session.blocks.length).toBeGreaterThanOrEqual(1);
      expect(session.computed?.totalDuration ?? 0).toBeGreaterThan(0);
      // Ningun ejercicio critico puede entrar en la sesion.
      for (const block of session.blocks) {
        expect(criticalExerciseIds.has(block.exerciseId)).toBe(false);
      }
    },
  );

  // Cobertura del catalogo ACTUAL. Esto SI puede cambiar legitimamente si se
  // recorta el catalogo curado: si rompe, es senal de cobertura del catalogo,
  // no un fallo de la feature.
  it.each(PROBLEM_TEMPLATES)(
    "current curated catalog yields a full (>=3 block) session for '$id'",
    (template) => {
      const plan = buildSessionPlanFromProblemTemplate(template, exercises);
      const session = materializeDiagnosisSession(
        baseSession(),
        plan,
        exercises,
      );
      expect(session.blocks.length).toBeGreaterThanOrEqual(3);
    },
  );

  it("returns undefined for an unknown template id", () => {
    expect(getProblemTemplate("does-not-exist")).toBeUndefined();
  });
});

describe("startFromProblemTemplate store action", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  it("generates a real session and navigates to sessions", () => {
    const ok = useAppStore
      .getState()
      .startFromProblemTemplate("salida-bajo-presion");
    expect(ok).toBe(true);
    const state = useAppStore.getState();
    expect(state.view).toBe("sessions");
    expect(state.session.blocks.length).toBeGreaterThanOrEqual(1);
    expect(state.session.computed?.totalDuration ?? 0).toBeGreaterThan(0);
  });

  it("falls back to false and leaves state untouched for an unknown template", () => {
    const before = useAppStore.getState().session;
    const ok = useAppStore.getState().startFromProblemTemplate("nope");
    expect(ok).toBe(false);
    const after = useAppStore.getState();
    expect(after.session).toBe(before);
    expect(after.view).toBe("home");
  });

  it("sets aiPrompt when empty but never clobbers user input", () => {
    useAppStore.setState({ aiPrompt: "" });
    useAppStore.getState().startFromProblemTemplate("presion-alta");
    expect(useAppStore.getState().aiPrompt).toBe(
      getProblemTemplate("presion-alta")?.description,
    );

    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.setState({ aiPrompt: "mi problema escrito a mano" });
    useAppStore.getState().startFromProblemTemplate("presion-alta");
    expect(useAppStore.getState().aiPrompt).toBe("mi problema escrito a mano");
  });
});
