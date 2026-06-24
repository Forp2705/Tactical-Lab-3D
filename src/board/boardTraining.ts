import type { BoardScene, TacticalBoard } from "./boardModel";

/**
 * Fields needed to materialize a faithful, DT-authored training block from a
 * board's workspace. The DT's free text (problem + exercise builder) is
 * preserved verbatim — nothing here invents a generic block.
 */
export type BoardTrainingDraft = {
  title: string;
  durationMin: number;
  objectivePrimary: string;
  organization: string;
  space: string;
  rules: string[];
  coaching: string[];
  success: string;
  progressions: string[];
  notes: string;
};

/** Parse a free-text duration like "12 min" into minutes; fallback if absent. */
export function parseDurationMinutes(text: string, fallback: number): number {
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanLines(lines: Array<string | false | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/**
 * Map a board's workspace (tactical problem + exercise builder + roster) into a
 * training-block draft. Used by the store to create a real, linked SessionBlock
 * that reflects what the DT actually wrote.
 */
export function buildBoardTrainingDraft(
  board: TacticalBoard,
  scene: BoardScene,
): BoardTrainingDraft {
  const { problem, exercise, roster } = board.workspace;

  const title =
    scene.title.trim() || board.title.trim() || "Bloque desde pizarra";

  const durationMin = parseDurationMinutes(
    exercise.duration,
    board.defaults.sceneDurationMin,
  );

  const objectivePrimary =
    exercise.objective.trim() ||
    problem.objective.trim() ||
    board.globalInstruction.trim() ||
    `Trabajar ${title}`;

  const organization =
    cleanLines([
      exercise.players.trim() && `Jugadores: ${exercise.players.trim()}`,
      exercise.space.trim() && `Espacio: ${exercise.space.trim()}`,
      roster.length > 0 && `Plantel: ${roster.length} jugadores cargados`,
    ]) || "Organizacion segun la pizarra: roles, distancias y referencias.";

  const rules = exercise.rule.trim() ? [exercise.rule.trim()] : [];
  const coaching = exercise.coachCorrection.trim()
    ? [exercise.coachCorrection.trim()]
    : [];
  const progressions = exercise.progression.trim()
    ? [exercise.progression.trim()]
    : [];

  const success =
    exercise.successCondition.trim() ||
    board.successSignals[0] ||
    "El comportamiento aparece bajo oposicion.";

  const notes = cleanLines([
    problem.problem.trim() && `Problema: ${problem.problem.trim()}`,
    `Objetivo: ${objectivePrimary}`,
    exercise.players.trim() && `Jugadores: ${exercise.players.trim()}`,
    exercise.space.trim() && `Espacio: ${exercise.space.trim()}`,
    exercise.rule.trim() && `Regla: ${exercise.rule.trim()}`,
    `Senal de exito: ${success}`,
    exercise.progression.trim() && `Progresion: ${exercise.progression.trim()}`,
    exercise.coachCorrection.trim() &&
      `Correccion DT: ${exercise.coachCorrection.trim()}`,
    `Origen: Pizarra "${board.title}" / escena "${scene.title}"`,
  ]);

  return {
    title,
    durationMin,
    objectivePrimary,
    organization,
    space: exercise.space.trim(),
    rules,
    coaching,
    success,
    progressions,
    notes,
  };
}
