import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../src/data";
import { useAppStore } from "../src/state/useAppStore";
import type { WeeklyDecisionThread } from "../src/state/weeklyDecisionThread";

/**
 * W19 (mc-19, H5) — guard del flip "trained" en `addToSession`.
 *
 * Antes, CUALQUIER drop manual del catalogo marcaba el hilo semanal como
 * `trained` y fabricaba un `sessionIntent` sintetico, aunque el ejercicio no
 * tuviera relacion con el problema del thread: el hilo reportaba "Entrenado"
 * sin sesion ligada (huerfano inverso, W19-FLOW-AUDIT H5). El fix condiciona
 * el flip a `isSessionLinkedToThread` (mismo vinculo textual que ya exige
 * `createSessionFromWeeklyThread`) y elimina la fabricacion de intent.
 *
 * Patron de tests/realWorkspaceDemoIsolation.test.ts: reset del store por
 * `setState(getInitialState(), true)` y acciones publicas — sin helpers
 * internos.
 */

const THREAD_PROBLEM =
  "Cuando perdemos arriba, el pivote queda demasiado expuesto.";

function makeThread(): WeeklyDecisionThread {
  return {
    id: "thread-w19-guard",
    teamId: useAppStore.getState().team.id,
    problem: THREAD_PROBLEM,
    origin: "coach",
    evidenceIds: [],
    mode: "hypothesis",
    confidence: 0.6,
    sessionIntent: null,
    nextReviewCriteria: ["Revisar el ajuste en el siguiente partido."],
    status: "open",
    progress: "open",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("W19 H5 — addToSession no flipea el thread sin vinculo real", () => {
  it("un drop sobre una sesion sin relacion con el problema NO marca trained ni fabrica sessionIntent", () => {
    useAppStore.setState({
      weeklyDecisionThread: makeThread(),
      session: {
        id: "session-manual",
        name: "Sesion manual",
        blocks: [],
        staffNotes: "",
      },
    });

    useAppStore.getState().addToSession(catalog[0].id);

    const thread = useAppStore.getState().weeklyDecisionThread;
    expect(useAppStore.getState().session.blocks).toHaveLength(1);
    expect(thread?.status).toBe("open");
    expect(thread?.sessionIntent).toBeNull();
  });

  it("un drop sobre la sesion materializada del thread SI marca trained", () => {
    useAppStore.setState({
      weeklyDecisionThread: makeThread(),
      session: {
        id: "session-thread",
        name: "Sesion del foco semanal",
        blocks: [],
        // Mismo vinculo textual que evalua isSessionLinkedToThread (el
        // materializador escribe el problema del plan en staffNotes).
        staffNotes: `Problema: ${THREAD_PROBLEM}`,
      },
    });

    useAppStore.getState().addToSession(catalog[0].id);

    const thread = useAppStore.getState().weeklyDecisionThread;
    expect(useAppStore.getState().session.blocks).toHaveLength(1);
    expect(thread?.status).toBe("trained");
  });
});
