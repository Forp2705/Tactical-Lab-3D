import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AiView } from "../src/ai/AiView";
import { HomeView } from "../src/home/HomeView";
import { isTeamIdentityBootstrapped, isTeamIdentityConfigured } from "../src/data/teamIdentitySetup";
import { buildSessionPlanFromWeeklyThread, materializeDiagnosisSession } from "../src/sessions/diagnosisSession";
import { SessionsView } from "../src/sessions/SessionsView";
import { catalog } from "../src/data";
import { SessionBlockSchema } from "../src/data/schemas";
import { useAppStore } from "../src/state/useAppStore";
import {
  buildSessionIntentFromProblem,
  type WeeklyDecisionThread,
} from "../src/state/weeklyDecisionThread";
import { buildWeeklyDecisionCardModel } from "../src/ui/WeeklyDecisionCard";

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    weeklyDecisionThread: {
      id: "weekly-thread-test",
      teamId: useAppStore.getState().team.id,
      origin: "manualObservation",
      mode: "hypothesis",
      problem: "Nos cuesta salir desde el fondo",
      confidence: 0.38,
      evidenceIds: ["obs-1"],
      sessionIntent: buildSessionIntentFromProblem("Nos cuesta salir desde el fondo"),
      nextReviewCriteria: [
        "Revisar si el pivote vuelve a quedar tapado en el proximo partido.",
      ],
      status: "open",
      progress: "open",
      createdAt: "2026-06-12T10:00:00.000Z",
      updatedAt: "2026-06-12T10:00:00.000Z",
    } satisfies WeeklyDecisionThread,
    aiPrompt: "Nos cuesta salir desde el fondo",
  });
});

describe("Weekly Coach Immediacy Pass", () => {
  it("renders Boceto rapido from Sala", () => {
    const markup = renderToStaticMarkup(<HomeView />);
    expect(markup).toContain("Boceto rapido");
    expect(markup).toContain("Sala semanal");
  });

  it("renders Boceto rapido and create-from-focus on an empty session", () => {
    const markup = renderToStaticMarkup(<SessionsView />);
    expect(markup).toContain("Crear sesion desde foco semanal");
    expect(markup).toContain("Boceto rapido");
  });

  it("renders advanced diagnostics behind an Avanzado affordance", () => {
    const markup = renderToStaticMarkup(<AiView />);
    expect(markup).toContain("Avanzado");
    expect(markup).not.toContain("Contexto completo del agente");
  });

  it("derives a coach-readable weekly decision card without overstating weak evidence", () => {
    const model = buildWeeklyDecisionCardModel({
      thread: useAppStore.getState().weeklyDecisionThread,
    });

    expect(model).not.toBeNull();
    expect(model?.confidenceLabel).toBe("Baja");
    expect(model?.confidenceSummary).toContain("usar como hipotesis");
    expect(model?.whatIsMissing).toContain("falta confirmar");
  });

  it("creates a deterministic weekly session draft with valid block schema", () => {
    const thread = useAppStore.getState().weeklyDecisionThread;
    expect(thread).not.toBeNull();
    if (!thread) return;

    const plan = buildSessionPlanFromWeeklyThread(thread, catalog);
    const session = materializeDiagnosisSession(
      useAppStore.getState().session,
      plan,
      catalog,
    );

    expect(plan.exerciseIds.length).toBeGreaterThanOrEqual(3);
    expect(plan.exerciseIds.length).toBeLessThanOrEqual(4);
    expect(session.staffNotes).toContain("Problema semanal:");
    expect(session.blocks.every((block) => SessionBlockSchema.safeParse(block).success)).toBe(true);
  });

  it("treats minimal onboarding fields as bootstrapped while leaving advanced identity deferred", () => {
    useAppStore.getState().updateTeamIdentity({
      teamName: "Atletico Norte",
      squadLevel: "amateur",
      baseFormation: "4-3-3",
      trainingDays: 3,
    });

    const identity = useAppStore.getState().teamIdentity;
    expect(isTeamIdentityBootstrapped(identity)).toBe(true);
    expect(isTeamIdentityConfigured(identity)).toBe(false);
    expect(identity.pressingPreference).toBe("");
    expect(identity.buildUpPreference).toBe("");
  });
});
