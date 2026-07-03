import { describe, expect, it } from "vitest";
import {
  resolveExerciseSelection,
  resolveViewerSelection,
} from "../src/app/viewerSelection";
import type { Exercise } from "../src/data";
import { catalog } from "../src/data/exercises/catalog";
import { retiredExerciseIds } from "../src/data/exercises/retiredExercises";

/**
 * W4 (mc-19): valida el camino 2 del brief de persistencia — un
 * `selectedExerciseId` de snapshot que referencia un id ya retirado del
 * catalog. Antes del fix, `getExerciseById` (useAppStore.ts) resolvia esto
 * a `catalog[0]` sin ninguna senal (el gate mc-10 lo marco como sospecha
 * concreta). `resolveViewerSelection` es la logica que reemplaza ese
 * call-site en `ViewerWorkspace` (App.tsx) y expone `missing` para que el
 * visor pueda avisar en vez de sustituir en silencio.
 */
describe("resolveViewerSelection — id retirado en selectedExerciseId", () => {
  const retiredId = [...retiredExerciseIds.keys()][0];
  const exercises: Exercise[] = catalog;

  it("id vigente resuelve normal, sin marcar missing", () => {
    const vigenteId = catalog[1].id;
    const result = resolveViewerSelection(vigenteId, null, exercises);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(vigenteId);
  });

  it("id retirado no crashea, cae a catalog[0] y marca missing:true", () => {
    expect(() =>
      resolveViewerSelection(retiredId, null, exercises),
    ).not.toThrow();
    const result = resolveViewerSelection(retiredId, null, exercises);
    expect(result.missing).toBe(true);
    expect(result.exercise.id).toBe(catalog[0].id);
  });

  it("id retirado con variante local homonima resuelve la variante, no missing", () => {
    const variant: Exercise = {
      ...catalog[0],
      id: `${retiredId}__variant__123`,
    };
    const result = resolveViewerSelection(variant.id, null, [
      ...catalog,
      variant,
    ]);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(variant.id);
  });

  it("viewerExerciseOverride activo gana siempre, sin importar el id seleccionado", () => {
    const override: Exercise = catalog[2];
    const result = resolveViewerSelection(retiredId, override, exercises);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(override.id);
  });
});

/**
 * W5 (mc-19): valida el residual declarado de W4 — HomeView (card "Ejercicio
 * actual" y SessionCard), AppShell (top-stat-strip) y LibraryView (panel de
 * detalle) usaban `getExerciseById(...) ?? catalog[0]` sin exponer que el id
 * no resolvia. Los 4 call sites ahora usan `resolveExerciseSelection`, el
 * nucleo del que tambien depende `resolveViewerSelection` (mismo helper, sin
 * duplicar semantica).
 */
describe("resolveExerciseSelection — nucleo reusado por Home/AppShell/Library", () => {
  const retiredId = [...retiredExerciseIds.keys()][0];
  const exercises: Exercise[] = catalog;

  it("id vigente resuelve normal, sin marcar missing", () => {
    const vigenteId = catalog[1].id;
    const result = resolveExerciseSelection(vigenteId, exercises);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(vigenteId);
  });

  it("id retirado no crashea, cae a catalog[0] y marca missing:true", () => {
    expect(() => resolveExerciseSelection(retiredId, exercises)).not.toThrow();
    const result = resolveExerciseSelection(retiredId, exercises);
    expect(result.missing).toBe(true);
    expect(result.exercise.id).toBe(catalog[0].id);
  });

  it("id inexistente (nunca existio en el catalog) tambien cae a catalog[0] con missing:true", () => {
    const result = resolveExerciseSelection(
      "este-id-nunca-existio-en-el-catalog",
      exercises,
    );
    expect(result.missing).toBe(true);
    expect(result.exercise.id).toBe(catalog[0].id);
  });

  it("id retirado con variante local homonima resuelve la variante, no missing", () => {
    const variant: Exercise = {
      ...catalog[0],
      id: `${retiredId}__variant__456`,
    };
    const result = resolveExerciseSelection(variant.id, [...catalog, variant]);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(variant.id);
  });

  it("resolveViewerSelection sin override delega en resolveExerciseSelection (mismo resultado)", () => {
    const viaViewer = resolveViewerSelection(retiredId, null, exercises);
    const viaCore = resolveExerciseSelection(retiredId, exercises);
    expect(viaViewer).toEqual(viaCore);
  });
});

/**
 * W6 (mc-19): ultimo call site conocido del patron — AiView.tsx (ContextRow
 * "Ejercicio actual" en el panel "Avanzado"). Excluido de W4/W5 por la
 * restriccion no-IA; ahora tiene permiso acotado solo para esto. AiView usa
 * el mismo nucleo (catalog + exerciseVariants) que Home/AppShell/Library, sin
 * logica nueva en el helper. A diferencia de esos call sites, el valor
 * resuelto en AiView NO se inyecta en el payload al coach
 * (`buildCoachRuntimeContext` no tiene ningun campo de ejercicio) — el fix
 * es puramente de display, verificado por separado con Playwright
 * interceptando el fetch a /api/coach-agent.
 */
describe("resolveExerciseSelection — call site de AiView (contexto Diagnostico)", () => {
  const retiredId = [...retiredExerciseIds.keys()][0];
  const exercises: Exercise[] = catalog;

  it("id vigente resuelve normal, sin marcar missing", () => {
    const vigenteId = catalog[1].id;
    const result = resolveExerciseSelection(vigenteId, exercises);
    expect(result.missing).toBe(false);
    expect(result.exercise.id).toBe(vigenteId);
  });

  it("id retirado marca missing:true en vez de sustituir en silencio", () => {
    const result = resolveExerciseSelection(retiredId, exercises);
    expect(result.missing).toBe(true);
    expect(result.exercise.id).toBe(catalog[0].id);
  });
});
