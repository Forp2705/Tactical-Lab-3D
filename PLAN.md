# PLAN — FIX 1: Quick Start honesto (mc-22, Ola 1)

Branch: `fix/w1-quickstart-honest` desde `origin/main` = `1bad717`. Scope estricto: `src/data/exercises/validatedCatalog.ts` + `tests/quickStartHonestPool.test.ts` (nuevo). Nada más.

## 1. Cambio

`getSelectableCatalog()` pasa a excluir **también** `generatedLibraryExerciseIds` (además de `criticalExerciseIds`). El import de `./catalog.js` ya trae `generatedLibraryExerciseIds` en el archivo. Con esto los pools de los motores (`useAppStore.ts:1580,1584,1599,1627,1631`, `AiView.tsx:1093`) quedan simétricos con lo que la Biblioteca (`LibraryView.tsx:50`) y el picker de Sesión (`SessionsView.tsx:94`) ya muestran: los 15 curados a mano.

## 2. Decisión: semántica de `isSelectableExercise()`

**Evidencia de call sites (grep repo completo en 1bad717):** `isSelectableExercise` tiene CERO consumidores reales. Aparece solo en:
- `src/data/exercises/validatedCatalog.ts:28` (definición)
- `src/data/index.ts:17` (re-export del barrel)

No hay ningún flujo que la use hoy — ni para elegir ni para validar. La decisión es entonces sobre qué contrato deja el archivo para futuros callers.

**Decisión: `isSelectableExercise` NO excluye generados — mantiene `!critical`.** Queda como chequeo de *validez de una referencia existente* (bloque de sesión guardada, variante, id persistido), mientras `getSelectableCatalog` es el *pool para selecciones nuevas*. Razones:

1. Ya existen datos persistidos que referencian generados: el propio bug (reproducido en vivo en la auditoría) creó sesiones Quick Start con bloques generados en IndexedDB de usuarios/testers. Esos ejercicios existen en el catálogo y funcionan (escena genérica pero reproducible); un futuro caller que valide bloques guardados con una `isSelectableExercise` endurecida los marcaría rotos sin necesidad.
2. `SessionsView.tsx:444,930` resuelve bloques contra el `catalog` completo — el producto ya trata "referenciable" ≠ "elegible". La función acompaña esa distinción.
3. Endurecerla no aporta nada hoy (cero callers) y crea un riesgo de rotura de datos mañana.

La distinción queda explícita en comentarios sobre ambas funciones.

## 3. Test de regresión: `tests/quickStartHonestPool.test.ts`

Complementa `tests/problemTemplates.test.ts` (que ya afirma sesión no vacía + sin críticos, pero NO bloquea generados). Casos:

1. **Pool honesto:** `getSelectableCatalog()` no contiene ningún id de `generatedLibraryExerciseIds` ni de `criticalExerciseIds`, y no queda vacío (>= 10, colchón anti-drift sobre los 15 actuales).
2. **Regresión por template (enmienda gate mc-99):** para CADA uno de los 5 `PROBLEM_TEMPLATES`, `buildSessionPlanFromProblemTemplate(template, getSelectableCatalog())` produce `exerciseIds.length > 0` y **ningún** id generado ni crítico. Red contra el silent-no-op de `HomeView.tsx:477` (ignora el boolean de retorno) y contra drift futuro del catálogo.
3. **Contrato de referencia:** `isSelectableExercise(<id generado>)` sigue devolviendo `true` y `isSelectableExercise(<id crítico>)` devuelve `false` — fija la semántica decidida en §2 para que un cambio accidental la rompa en verde→rojo.

## 4. Validación

- `npm test -- --run tests/quickStartHonestPool.test.ts` (nuevo, verde)
- `npm test -- --run tests/validateExercise.test.ts`
- `npm test -- --run` (suite completa)
- `npm run type-check && npm run build`
- **En vivo** (`npm run dev` + Playwright): disparar los 5 Quick Start desde la Sala y verificar que ningún bloque lleva título de `compactCuratedSpecs` (`catalog.ts:2349-2493`); listar los ejercicios por template en el worker_done.

## 5. Riesgos residuales (documentados, fuera de scope)

- `exerciseQualityReport.test.ts` / otros tests podrían asumir el pool viejo de `getSelectableCatalog` → si la suite completa marca algo, se evalúa: si el test fija el comportamiento viejo (pool con generados), se ajusta SOLO ese assert... **no**: scope estricto = si un test existente rojo requiere tocar otro archivo, escalation al coordinador antes de tocarlo.
- Un advice de coach viejo persistido que referencie un id generado dejará de resolver en `AiView` (acción "abrir relacionado" no encuentra el ejercicio y no se ofrece). Es el comportamiento honesto; no rompe render.
- Los 21 generados quedan como deuda de contenido (borrarlos o darles escena real es decisión de producto pendiente).

## 6. Guard EOL

`git diff --stat` antes de cada commit; si un archivo tocado aparece como whole-file diff (renormalización EOL), parar y escalar.
