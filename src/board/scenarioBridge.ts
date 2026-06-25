import type { Exercise, Player } from "@/data";
import type { GameModel } from "@/data/gameModel";
import type { ScenarioId, ScenarioInput } from "@/ai/scenarioSimulator";
import type { BoardScene } from "@/board/boardModel";
import type { TacticalProblem } from "@/board/productBoardTypes";

/**
 * Pure bridge: turns the relational Pizarra scene into the simulator's
 * ScenarioInput. Own playerTokens carry an optional linkedPlayerId; only
 * linked tokens contribute a real Player (direct lookup in team.players —
 * NO collectPayloadPlayers, which produces the lossy PlanningBoardPlayer).
 * metrics is always null (CoachShapeMetrics belongs to LineupLab, not the
 * board); the simulator degrades honestly. unlinkedCount feeds the panel's
 * honest degradation.
 *
 * `problem` is the board's TacticalProblem (it lives in the orchestrator, not
 * in BoardScene): objective ← problem.objective, evidenceText ← problem.problem.
 */
export function buildScenarioInput(
  scene: BoardScene,
  teamPlayers: Player[],
  gameModel: GameModel,
  exercises: Exercise[],
  scenarioId: ScenarioId,
  problem?: TacticalProblem,
): { input: ScenarioInput; unlinkedCount: number } {
  const byId = new Map(teamPlayers.map((p) => [p.id, p]));
  const ownTokens = scene.objects.filter((o) => o.type === "playerToken");

  const players: Player[] = [];
  let unlinkedCount = 0;
  for (const token of ownTokens) {
    const linked = token.linkedPlayerId ? byId.get(token.linkedPlayerId) : undefined;
    if (linked) players.push(linked);
    else unlinkedCount += 1;
  }

  const objective = problem?.objective?.trim() || undefined;
  const evidenceText = problem?.problem?.trim() || undefined;

  const input: ScenarioInput = {
    scenarioId,
    objective,
    metrics: null,
    gameModel,
    players,
    evidenceText,
    exercises,
  };

  return { input, unlinkedCount };
}
