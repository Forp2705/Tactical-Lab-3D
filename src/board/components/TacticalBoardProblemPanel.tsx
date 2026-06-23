import { exerciseFields } from "../boardConstants";
import type { ExerciseBuilder, TacticalProblem } from "../productBoardTypes";

type TacticalBoardProblemPanelProps = {
  problem: TacticalProblem;
  exercise: ExerciseBuilder;
  onProblemChange: (problem: TacticalProblem) => void;
  onExerciseChange: (exercise: ExerciseBuilder) => void;
};

export function TacticalBoardProblemPanel({
  problem,
  exercise,
  onProblemChange,
  onExerciseChange,
}: TacticalBoardProblemPanelProps) {
  return (
    <>
      <section>
        <h2>Problema tactico</h2>
        <label>
          Problema
          <textarea
            value={problem.problem}
            onChange={(event) =>
              onProblemChange({ ...problem, problem: event.target.value })
            }
          />
        </label>
        <label>
          Objetivo
          <textarea
            value={problem.objective}
            onChange={(event) =>
              onProblemChange({ ...problem, objective: event.target.value })
            }
          />
        </label>
      </section>

      <section>
        <h2>Constructor de ejercicio</h2>
        {exerciseFields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              value={exercise[field.key]}
              onChange={(event) =>
                onExerciseChange({
                  ...exercise,
                  [field.key]: event.target.value,
                })
              }
            />
          </label>
        ))}
      </section>
    </>
  );
}
