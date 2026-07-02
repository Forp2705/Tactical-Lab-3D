import { describe, expect, it } from "vitest";
import type { SessionBlock } from "../src/data";
import { recomputeFallback } from "../src/sessions/SessionsView";
import { useAppStore } from "../src/state/useAppStore";

/**
 * H1 (mc-19): bloques de sesion con ejercicios propios (creados desde
 * blanco/pizarra/duplicado/importado) viven en exerciseVariants, no en
 * catalog. recomputeFallback debe resolverlos igual que SessionBlockCard.
 */
describe("recomputeFallback — bloques con ejercicios propios (exerciseVariants)", () => {
  it("ignora el bloque si solo se busca en catalog (reproduce el bug)", () => {
    const exerciseId = useAppStore.getState().createBlankExercise({
      title: "Bloque propio de test",
    });
    expect(exerciseId).toBeTruthy();

    const block: SessionBlock = {
      id: "block-test-1",
      exerciseId: exerciseId as string,
      durationMin: 15,
      swappable: true,
    };

    const withoutVariants = recomputeFallback([block], []);
    expect(withoutVariants.totalDuration).toBe(0);
    expect(withoutVariants.totalLoad).toBe(0);
  });

  it("resuelve duracion y carga cuando se combina catalog + exerciseVariants", () => {
    const exerciseId = useAppStore.getState().createBlankExercise({
      title: "Bloque propio de test 2",
    });
    expect(exerciseId).toBeTruthy();
    const exercise = useAppStore
      .getState()
      .exerciseVariants.find((item) => item.id === exerciseId);
    expect(exercise).toBeTruthy();

    const block: SessionBlock = {
      id: "block-test-2",
      exerciseId: exerciseId as string,
      durationMin: 15,
      swappable: true,
    };

    const result = recomputeFallback(
      [block],
      useAppStore.getState().exerciseVariants,
    );

    expect(result.totalDuration).toBe(15);
    expect(result.totalLoad).toBe(15 * (exercise?.rpe ?? 0));
  });
});
