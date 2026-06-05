import { runDeterministicCoachEval } from "../src/ai/eval/runCoachContinuousEval.js";

const minScore = Number(process.env.COACH_EVAL_MIN_SCORE) || 0.72;
const result = runDeterministicCoachEval({ minScore });

console.log(JSON.stringify(result, null, 2));

if (result.failed > 0) {
  process.exitCode = 1;
}
