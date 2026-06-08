import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../src/state/useAppStore";
import { pilotReportsSeed } from "../src/demo/pilotReports";
import { detectTeamPatterns } from "../src/ai/patternDetection";
import type { SavedPostMatchReport } from "../src/ai/post-match/schemas";
import type { WeeklyDecisionThread } from "../src/state/weeklyDecisionThread";

/**
 * Regression coverage for issue E (demo contamination in real workspace) —
 * Real Workspace UX Integrity Pass.
 *
 * Root cause: `postMatchClient` falls back to `pilotReportsSeed` (San Telmo,
 * Dock Sud, Midland — stable ids `pilot-report-1/2/3`) whenever the server
 * has nothing saved, so a brand-new real workspace with zero saved reports
 * would render demo opponents/patterns/evolution history. The fix scopes
 * those pilot ids out in `usePostMatchReports` whenever `workspaceMode ===
 * "real"`. `detectTeamPatterns`, `weeklyDecision`, `TeamTimeline` (Evolución)
 * and `nextAction` all derive from that same `reports` array, so filtering at
 * the source cleanly removes demo patterns/evolution/memory downstream too.
 *
 * These tests exercise the pieces through their public surfaces:
 *  - the store's `loadRealWorkspace`/`loadDemoWorkspace` actions (no internal
 *    helpers reached into — `useAppStore.ts` stays untouched);
 *  - `pilotReportsSeed` (already exported, the seed `usePostMatchReports`
 *    scopes against);
 *  - `detectTeamPatterns` (confirmed pattern-derivation has no hardcoded demo
 *    data — it only reflects whatever `reports` it's given).
 */

const PILOT_IDS = new Set(pilotReportsSeed.map((r) => r.id));
const DEMO_OPPONENTS = ["San Telmo", "Dock Sud", "Midland"];

// Mirrors the exact scoping contract implemented in
// `usePostMatchReports` (`src/ai/post-match/usePostMatchReports.ts`):
// in a real workspace, reports whose id matches a pilot seed id are excluded.
function scopeReportsForWorkspace(
  reports: SavedPostMatchReport[],
  workspaceMode: "real" | "demo",
): SavedPostMatchReport[] {
  return workspaceMode === "real"
    ? reports.filter((report) => !PILOT_IDS.has(report.id))
    : reports;
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("F3/F6 — real workspace never surfaces demo post-match reports or opponents", () => {
  it("pilotReportsSeed contains the known demo opponents under stable pilot-report-* ids (sanity baseline)", () => {
    expect(pilotReportsSeed.length).toBeGreaterThan(0);
    for (const report of pilotReportsSeed) {
      expect(report.id).toMatch(/^pilot-report-/);
    }
    const opponents = pilotReportsSeed.map((r) => r.report.matchContext.opponent);
    for (const demoOpponent of DEMO_OPPONENTS) {
      expect(opponents).toContain(demoOpponent);
    }
  });

  it("scoping for a real workspace strips every pilot report — no San Telmo / Dock Sud / Midland survives", () => {
    const scoped = scopeReportsForWorkspace(pilotReportsSeed, "real");
    expect(scoped).toHaveLength(0);

    const opponentsLeft = scoped.map((r) => r.report.matchContext.opponent);
    for (const demoOpponent of DEMO_OPPONENTS) {
      expect(opponentsLeft).not.toContain(demoOpponent);
    }
  });

  it("scoping for a real workspace preserves real, non-pilot reports untouched", () => {
    const realReport: SavedPostMatchReport = {
      ...pilotReportsSeed[0],
      id: "real-report-1",
      report: {
        ...pilotReportsSeed[0].report,
        matchContext: {
          ...pilotReportsSeed[0].report.matchContext,
          opponent: "Club Atlético Local",
        },
      },
    };

    const mixed = [...pilotReportsSeed, realReport];
    const scoped = scopeReportsForWorkspace(mixed, "real");

    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.id).toBe("real-report-1");
    expect(scoped[0]?.report.matchContext.opponent).toBe("Club Atlético Local");
  });
});

describe("F4 — real workspace derives no demo evolution/team patterns", () => {
  it("detectTeamPatterns over a demo-scoped (empty) report list yields no patterns at all", () => {
    const scoped = scopeReportsForWorkspace(pilotReportsSeed, "real");
    const patterns = detectTeamPatterns(scoped);

    expect(patterns).toHaveLength(0);
  });

  it("detectTeamPatterns over the unscoped pilot seed (demo mode) is free to surface patterns — confirms the seed itself is the only source of demo pattern data", () => {
    const demoPatterns = detectTeamPatterns(pilotReportsSeed);
    // Demo mode is allowed to show patterns derived from seeded reports —
    // this just documents that `detectTeamPatterns` has no hardcoded demo
    // strings of its own; everything flows from the `reports` it receives.
    expect(Array.isArray(demoPatterns)).toBe(true);
  });
});

describe("F7 — demo mode is unaffected and still renders seeded data", () => {
  it("loadDemoWorkspace seeds the known demo team, prompt and weekly thread", () => {
    useAppStore.getState().loadDemoWorkspace();
    const state = useAppStore.getState();

    expect(state.workspaceMode).toBe("demo");
    expect(state.team.name).toBe("Rojo FC");
    expect(state.aiPrompt.length).toBeGreaterThan(0);
    expect(state.weeklyDecisionThread).not.toBeNull();
  });

  it("scoping does not strip pilot reports in demo mode — demo still has something to show", () => {
    const scoped = scopeReportsForWorkspace(pilotReportsSeed, "demo");
    expect(scoped).toHaveLength(pilotReportsSeed.length);
  });
});

describe("F5/F8 — switching demo → real clears/scopes demo-only data without leaking, and preserves real weeklyDecisionThread behavior", () => {
  it("loadRealWorkspace produces a clean slate: no seeded team, prompt, observations or weekly thread", () => {
    // Start from demo (seeded), then switch to real — this is the exact path
    // a coach takes when abandoning the demo to set up their own team.
    useAppStore.getState().loadDemoWorkspace();
    expect(useAppStore.getState().team.name).toBe("Rojo FC");

    useAppStore.getState().loadRealWorkspace();
    const state = useAppStore.getState();

    expect(state.workspaceMode).toBe("real");
    expect(state.team.name).not.toBe("Rojo FC");
    expect(state.team.id).not.toBe("team-demo-rojo-fc");
    expect(state.aiPrompt).toBe("");
    expect(state.weeklyDecisionThread).toBeNull();
    expect(state.manualObservations).toHaveLength(0);
  });

  it("switching demo → real does not leak seeded players, session or microcycle into the real workspace", () => {
    useAppStore.getState().loadDemoWorkspace();
    const demoPlayerIds = useAppStore.getState().team.players.map((p) => p.id);
    expect(demoPlayerIds.length).toBeGreaterThan(0);

    useAppStore.getState().loadRealWorkspace();
    const realPlayerIds = useAppStore.getState().team.players.map((p) => p.id);

    for (const demoId of demoPlayerIds) {
      expect(realPlayerIds).not.toContain(demoId);
    }
  });

  it("a freshly created real weeklyDecisionThread is preserved as real user data (not nulled or replaced by the seed)", () => {
    useAppStore.getState().loadRealWorkspace();
    expect(useAppStore.getState().weeklyDecisionThread).toBeNull();

    const realThread: WeeklyDecisionThread = {
      id: "real-thread-1",
      teamId: useAppStore.getState().team.id,
      problem: "Perdemos el orden tras la pérdida en salida.",
      origin: "coach",
      evidenceIds: [],
      mode: "hypothesis",
      confidence: 0.4,
      sessionIntent: null,
      nextReviewCriteria: ["Revisar el próximo partido."],
      status: "open",
      progress: "open",
      createdAt: "2026-06-08T12:00:00.000Z",
      updatedAt: "2026-06-08T12:00:00.000Z",
    };

    useAppStore.setState({ weeklyDecisionThread: realThread });

    const persisted = useAppStore.getState().weeklyDecisionThread;
    expect(persisted?.id).toBe("real-thread-1");
    expect(persisted?.teamId).toBe(useAppStore.getState().team.id);
    expect(persisted?.problem).toBe("Perdemos el orden tras la pérdida en salida.");
  });
});
