import { describe, expect, it } from "vitest";
import {
  buildBoardTrainingDraft,
  createDefaultBoard,
  parseDurationMinutes,
} from "../src/board";
import type { ExerciseBuilder, TacticalProblem } from "../src/board";

const exercise: ExerciseBuilder = {
  objective: "Salir jugando ante presion 4-4-2",
  players: "7v5 + arquero",
  space: "40x44",
  duration: "14 min",
  rule: "Gol vale doble si progresa por el medio",
  successCondition: "Tres salidas limpias seguidas",
  progression: "Sumar un presionante",
  coachCorrection: "Perfilar al central abierto",
};

const problem: TacticalProblem = {
  problem: "El 5 queda tapado y perdemos la salida",
  objective: "Liberar al pivote con tercer hombre",
};

function boardWithWorkspace() {
  const board = createDefaultBoard("Salida limpia");
  return {
    ...board,
    workspace: { ...board.workspace, exercise, problem, roster: [] },
  };
}

describe("parseDurationMinutes", () => {
  it("parses leading minutes and falls back otherwise", () => {
    expect(parseDurationMinutes("14 min", 8)).toBe(14);
    expect(parseDurationMinutes("8", 99)).toBe(8);
    expect(parseDurationMinutes("", 8)).toBe(8);
    expect(parseDurationMinutes("abc", 8)).toBe(8);
    expect(parseDurationMinutes("0 min", 8)).toBe(8);
  });
});

describe("buildBoardTrainingDraft — preserves the DT's free text", () => {
  const board = boardWithWorkspace();
  const draft = buildBoardTrainingDraft(board, board.scenes[0]);

  it("maps each exercise-builder field verbatim", () => {
    expect(draft.objectivePrimary).toBe(exercise.objective);
    expect(draft.space).toBe(exercise.space);
    expect(draft.rules).toEqual([exercise.rule]);
    expect(draft.coaching).toEqual([exercise.coachCorrection]);
    expect(draft.progressions).toEqual([exercise.progression]);
    expect(draft.success).toBe(exercise.successCondition);
    expect(draft.durationMin).toBe(14);
  });

  it("composes organization from players and space", () => {
    expect(draft.organization).toContain(exercise.players);
    expect(draft.organization).toContain(exercise.space);
  });

  it("keeps the tactical problem and origin in the notes", () => {
    expect(draft.notes).toContain(`Problema: ${problem.problem}`);
    expect(draft.notes).toContain("Objetivo:");
    expect(draft.notes).toContain("Senal de exito:");
    expect(draft.notes).toContain(`Regla: ${exercise.rule}`);
    expect(draft.notes).toContain("Origen: Pizarra");
  });
});

describe("buildBoardTrainingDraft — sensible fallbacks", () => {
  it("falls back to the problem objective and board defaults when fields are empty", () => {
    const base = createDefaultBoard("Vacia");
    const board = {
      ...base,
      workspace: {
        ...base.workspace,
        exercise: {
          objective: "",
          players: "",
          space: "",
          duration: "",
          rule: "",
          successCondition: "",
          progression: "",
          coachCorrection: "",
        },
        problem: { problem: "", objective: "Recuperar y atacar rapido" },
        roster: [],
      },
    };
    const draft = buildBoardTrainingDraft(board, board.scenes[0]);
    expect(draft.objectivePrimary).toBe("Recuperar y atacar rapido");
    expect(draft.rules).toEqual([]);
    expect(draft.coaching).toEqual([]);
    expect(draft.durationMin).toBe(base.defaults.sceneDurationMin);
  });

  it("notes a loaded roster in the organization", () => {
    const base = createDefaultBoard("Con plantel");
    const board = {
      ...base,
      workspace: {
        ...base.workspace,
        roster: [
          {
            id: "p1",
            name: "Uno",
            position: "MC",
            number: 5,
            traits: "",
            team: "A" as const,
          },
        ],
      },
    };
    const draft = buildBoardTrainingDraft(board, board.scenes[0]);
    expect(draft.organization).toContain("1 jugadores cargados");
  });
});
