import { describe, expect, it } from "vitest";
import { catalog } from "../src/data/exercises/catalog";
import { validateExercise } from "../src/data/exercises/validateExercise";
import {
  auditCatalog,
  criticalExerciseIds,
} from "../src/data/exercises/validatedCatalog";

describe("validateExercise — dominios y score fino", () => {
  it("expone los dominios resueltos del ejercicio", () => {
    const pressing = validateExercise(byId("presion-arquero-pase-atras"));
    expect(pressing.domains).toContain("pressing");

    const abp = catalog.find((e) => e.phase === "abpOff");
    if (abp) {
      expect(validateExercise(abp).domains).toContain("setPieces");
    }
  });

  it("el score discrimina calidad (no es todo 100)", () => {
    const scores = catalog.map((e) => validateExercise(e).score);
    const distinct = new Set(scores);
    expect(distinct.size).toBeGreaterThan(1);
    expect(scores.some((s) => s < 100)).toBe(true);
    expect(scores.some((s) => s === 100)).toBe(true);
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("un ABP sin arquero baja score con tag missing-gk sin volverse critico", () => {
    const abp = catalog.find(
      (e) =>
        (e.phase === "abpOff" || e.phase === "abpDef") &&
        !e.scene.actors.some((a) => /gk|arq|portero/i.test(a.role)),
    );
    if (!abp) return; // si todos los ABP tienen arquero, no hay nada que probar
    const result = validateExercise(abp);
    expect(result.tags).toContain("missing-gk");
    expect(result.warnings.some((i) => i.tag === "missing-gk")).toBe(true);
    expect(result.critical).toBe(false);
  });

  it("las reglas de dominio bajan score via warnings, no via nuevos criticos", () => {
    // El unico critico sigue siendo el ejercicio roto detectado en etapa 1.
    expect([...criticalExerciseIds]).toEqual(["presion-arquero-pase-atras"]);
  });

  it("es deterministica", () => {
    const a = catalog.map((e) => validateExercise(e).score);
    const b = catalog.map((e) => validateExercise(e).score);
    expect(a).toEqual(b);
  });
});

describe("auditCatalog — reporte de calidad", () => {
  it("audita el catalogo, ordena por score ascendente y es determinista", () => {
    const audit = auditCatalog();
    expect(audit.total).toBe(catalog.length);
    for (let i = 1; i < audit.entries.length; i += 1) {
      expect(audit.entries[i].score).toBeGreaterThanOrEqual(
        audit.entries[i - 1].score,
      );
    }
    expect(auditCatalog()).toEqual(audit);
  });

  it("el top-N peor incluye el ejercicio roto y solo entradas <100", () => {
    const audit = auditCatalog(catalog, 5);
    expect(audit.worst.length).toBeGreaterThan(0);
    expect(audit.worst.length).toBeLessThanOrEqual(5);
    expect(audit.worst.every((entry) => entry.score < 100)).toBe(true);
    expect(audit.worst[0].exerciseId).toBe("presion-arquero-pase-atras");
    expect(audit.worst[0].critical).toBe(true);
  });

  it("reporta conteo de problemas por tag y promedio coherente", () => {
    const audit = auditCatalog();
    expect(audit.byTag["missing-gk"]).toBeGreaterThanOrEqual(1);
    expect(audit.averageScore).toBeGreaterThan(0);
    expect(audit.averageScore).toBeLessThanOrEqual(100);
    expect(audit.criticalCount).toBe(criticalExerciseIds.size);
  });
});

function byId(id: string) {
  const exercise = catalog.find((item) => item.id === id);
  if (!exercise) throw new Error(`no encontrado: ${id}`);
  return exercise;
}
