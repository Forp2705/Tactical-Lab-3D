# PLAN — fix/w19-flujo (mc-19, W19 fase 2 REGION FLUJO)

Stacked sobre mc-18 @ 976518a. Spec = W19-FLOW-AUDIT.md con scope ajustado
(mc-18 ya pasó variants por la cadena del PDF). mc-22 en paralelo en REGION
BLOQUE del mismo SessionsView — este plan NO toca esa región ni recompute ni
DndContext.

## Lote A residual

1. **H2-residual** (`sessionPdf.tsx:59`): cuando el ejercicio no resuelve,
   rotular `"(retirado del catalogo) " + id` en vez del ID crudo pelado.
2. **H4** (`SessionsView.tsx:84` + `MicrocycleAlerts.ts:52-64`): la llamada
   pasa `[...catalog, ...exerciseVariants]`; `exerciseRepetitionAlerts` recibe
   `exercises` y mapea id→título en el mensaje (fallback al id si no resuelve,
   ejercicio retirado repetido sigue alertando). El literal del test
   (`aparece 3 veces`) se conserva → `microcycleAlerts.test.ts` sin cambios.
   `alertChipLabel` sigue matcheando ("aparece"+"veces en la sesion").

## Lote B (bordes del thread — FLAG AL GATE: toca store)

3. **H1 view-only** (`SessionsView.tsx` empty, región marcada línea 265): el
   CTA captura el retorno de `createSessionFromWeeklyThread()`; en `false`
   muestra hint honesto inline + link mono a Diagnóstico
   (`home-next-step-cta`, clase global de link gold sobre superficie oscura —
   cero CSS nuevo) que hace `setAiMode("coach") + setView("ai")`.
4. **H3 view-only** (`readSessionIntent`, SessionsView.tsx:1077): nuevo 4º arg
   opcional `sessionName`; si `sessionName.startsWith("Quick Start")`, el
   header deriva de los staffNotes del template (tags `Problema`/`Objetivo
   tactico`/`Senal de exito` — los que escribe
   `buildSessionPlanFromProblemTemplate`) y NO del thread viejo. Llamada del
   header pasa `session.name`. `PitchSideView` y `pitchSideMode.test` siguen
   compilando (arg opcional); el store no se toca para H3.
5. **H5 store MÍNIMO** (`useAppStore.ts:1400-1417` addToSession): flip
   `status:"trained"` SOLO si `isSessionLinkedToThread(nextSession, thread)`;
   se elimina la fabricación de `sessionIntent` en el drop. + test nuevo
   `tests/sessionThreadGuard.test.ts` (patrón realWorkspaceDemoIsolation:
   `setState(getInitialState(), true)` + acciones públicas): drop sin vínculo
   NO flipea ni fabrica intent; drop sobre sesión materializada del thread SÍ
   flipea.
6. **H6** (header hoja, región marcada línea 171): `session.name` como
   subtítulo (`<small className="muted">`, sin CSS nuevo).

## Validación

- tsc + build + suite completa.
- Vivo (dev server propio, puerto real del output): (a) Sala→Armar sesion,
  Diagnóstico→Convertir (fixture intercept W17) y Quick Start aterrizan con
  header honesto (QS con thread viejo muestra el problema del template);
  (b) drop de catálogo en sesión manual NO flipea el thread a Entrenado
  (se lee el estado en Diagnóstico), drop en sesión del thread sí;
  (c) bloque con exerciseId retirado (seed Dexie, ritual variante
  determinística de docs/qa/dexie-seed-smoke.md) → tombstone en card y PDF
  descargado con rótulo "(retirado del catalogo)";
  (d) empty real: click al CTA muestra hint + link a Diagnóstico navega.
- Capturas w19-flujo-*.png. Sin push. done UNA línea con SHA.
