import { beforeEach, describe, expect, it } from "vitest";
import { buildCoachTeamIdentityContext } from "../src/ai/coachTeamIdentityContext";
import {
  createDemoTeamIdentitySetup,
  createEmptyTeamIdentitySetup,
  isTeamIdentityConfigured,
} from "../src/data/teamIdentitySetup";
import { useAppStore } from "../src/state/useAppStore";

/**
 * Real Coach Onboarding (see src/home/RealCoachOnboarding.tsx) is a thin,
 * skippable guided layer over existing, already-tested primitives:
 * `updateTeamIdentity`, `isTeamIdentityConfigured`,
 * `buildCoachTeamIdentityContext`, `addManualObservation` and
 * `activateWeeklyThreadFromObservation`. These tests cover the gating and
 * write-path contracts the component relies on — not React rendering, which
 * the rest of this suite also avoids (no jsdom/testing-library setup here;
 * see sketchStore.test.ts for the same store-level convention).
 */

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("Real Coach Onboarding — visibility gating", () => {
  it("real workspace with no identity configured is the only condition where onboarding should appear", () => {
    useAppStore.getState().loadRealWorkspace();
    const state = useAppStore.getState();

    expect(state.workspaceMode).toBe("real");
    expect(isTeamIdentityConfigured(state.teamIdentity)).toBe(false);
    // This is exactly the gate HomeView uses to decide whether to render
    // <RealCoachOnboarding />: workspaceMode === "real" && !isTeamIdentityConfigured(...)
    expect(state.workspaceMode === "real" && !isTeamIdentityConfigured(state.teamIdentity)).toBe(true);
  });

  it("completing the guided steps writes through updateTeamIdentity and the gate closes", () => {
    useAppStore.getState().loadRealWorkspace();

    useAppStore.getState().updateTeamIdentity({
      teamName: "Atletico Norte",
      squadLevel: "amateur",
      baseFormation: "4-3-3",
      trainingDays: 3,
      pressingPreference: "Presion alta tras perdida",
      preferredDefensiveHeight: "high",
      buildUpPreference: "Salida corta por el costado fuerte",
    });

    const state = useAppStore.getState();
    expect(isTeamIdentityConfigured(state.teamIdentity)).toBe(true);
    expect(state.workspaceMode === "real" && !isTeamIdentityConfigured(state.teamIdentity)).toBe(false);
  });

  it("demo workspace never shows onboarding — identity arrives pre-seeded", () => {
    useAppStore.getState().loadDemoWorkspace();
    const state = useAppStore.getState();

    expect(state.workspaceMode).toBe("demo");
    expect(isTeamIdentityConfigured(state.teamIdentity)).toBe(true);
    expect(state.teamIdentity).toEqual(createDemoTeamIdentitySetup());
    expect(state.workspaceMode === "real" && !isTeamIdentityConfigured(state.teamIdentity)).toBe(false);
  });

  it("switching demo -> real never leaks demo identity into the real workspace", () => {
    useAppStore.getState().loadDemoWorkspace();
    expect(useAppStore.getState().teamIdentity.teamName).toBe(createDemoTeamIdentitySetup().teamName);

    useAppStore.getState().loadRealWorkspace();
    const realIdentity = useAppStore.getState().teamIdentity;

    expect(realIdentity).toEqual(createEmptyTeamIdentitySetup());
    expect(realIdentity.teamName).not.toBe(createDemoTeamIdentitySetup().teamName);
    expect(isTeamIdentityConfigured(realIdentity)).toBe(false);
  });
});

describe("Real Coach Onboarding — skip safety (Coach must not invent identity)", () => {
  it("skipping leaves the Coach identity context reporting 'not configured', never inferring a model", () => {
    useAppStore.getState().loadRealWorkspace();
    const state = useAppStore.getState();

    const context = buildCoachTeamIdentityContext({
      teamIdentity: state.teamIdentity,
      gameModel: state.gameModel,
    });

    expect(context.configured).toBe(false);
    // When not configured, summary/structuredGameModel fall back to the same
    // "missing" message — the Coach never fabricates a model from a skipped step.
    expect(context.summary).toBe(context.missingMessage);
    expect(context.structuredGameModel).toBe(context.missingMessage);
    expect(context.missingMessage.length).toBeGreaterThan(0);
  });
});

describe("Real Coach Onboarding — first weekly focus from 'Problema actual'", () => {
  it("a non-empty mainCurrentProblem opens a weak/manual hypothesis thread via the existing observation pipeline", () => {
    useAppStore.getState().loadRealWorkspace();

    const observationId = useAppStore.getState().addManualObservation({
      text: "Nos cuesta salir desde el fondo",
      source: "home",
    });
    expect(observationId).not.toBeNull();
    if (!observationId) return;

    useAppStore.getState().activateWeeklyThreadFromObservation(observationId);
    const thread = useAppStore.getState().weeklyDecisionThread;

    expect(thread).not.toBeNull();
    expect(thread?.origin).toBe("manualObservation");
    expect(thread?.mode).toBe("hypothesis");
    expect(thread?.confidence).toBeCloseTo(0.38, 2);
    expect(thread?.problem).toBe("Nos cuesta salir desde el fondo");
    expect(thread?.evidenceIds).toContain(observationId);
    expect(thread?.sessionIntent?.problem).toBe("Nos cuesta salir desde el fondo");
  });

  it("an empty problem leaves the weekly thread untouched (no thread is invented from nothing)", () => {
    useAppStore.getState().loadRealWorkspace();
    expect(useAppStore.getState().weeklyDecisionThread).toBeNull();

    const observationId = useAppStore.getState().addManualObservation({
      text: "   ",
      source: "home",
    });

    expect(observationId).toBeNull();
    expect(useAppStore.getState().weeklyDecisionThread).toBeNull();
  });
});
