# PLAN — W4 mc-22: ejecutar delete de los 10 ejercicios generados

Branch: `feat/w4-delete-generated` desde `origin/main` = `851df4c` (verificado). Ejecuta el
deletion path que yo mismo disene en W3 (`docs/plans/w3-reauthor-exercises-plan.md`, seccion
"Deletion path") sobre mi lista S/R/D (`docs/plans/w3-content-gk-audit-plan.md`, tabla T2).
Ola 4 = limpieza quirurgica. NADA de features nuevas.

## 1. Lista exacta de los 10 ids DELETE (con reemplazo curado = tombstone)

Todos viven HOY en `compactCuratedSpecs` (catalog.ts ~2855+, 17 specs generados tras W3). Cada
uno es borrable sin perdida porque su valor ya existe en un curado equivalente (columna →).

| # | id DELETE | fase | reemplazo curado (tombstone) |
|---|-----------|------|------------------------------|
| 1 | `presion-arquero-pase-atras` | defenseOrg | `pressing-portero-recibe` (duplicado exacto; ademas el UNICO critical del catalogo) |
| 2 | `posesion-6v3-hombre-libre` | attackOrg | `posesion-6v3-pivote` |
| 3 | `salida-3-1-pivote-sombra` | attackOrg | `salida-3-1` |
| 4 | `salida-vs-doble-punta` | attackOrg | `salida-3-1` |
| 5 | `contraataque-carril-central` | transOff | `contraataque-4v3` |
| 6 | `rondo-5v2-pared-interior` | attackOrg | `rondo-4v2-dos-zonas` |
| 7 | `bloque-medio-trampa-pivote` | defenseOrg | `bloque-medio-basculacion` |
| 8 | `abp-corner-corto-tercer-hombre` | abpOff | `abp-corner-corto` |
| 9 | `finalizacion-centro-raso` | attackOrg | `banda-centro-atras` |
| 10 | `tercer-hombre-banda-derecha` | attackOrg | `salida-lateral-tercer-hombre` |

Los 10 reemplazos EXISTEN como curados (verificado por grep de ids top-level en catalog.ts) y
son seleccionables (ninguno es critical ni generated).

NO tocar: los 7 generados restantes (salvage/rewrite-caro, siguen ocultos), ni ningun curado,
ni los 3 re-autorados de W3 (`abp-defensa-zona-rechace`, `transicion-perdida-cinco-segundos`,
`repliegue-temporizar-banda`).

## 2. Mecanica del delete (segura, en orden — el guard ANTES del borrado en el mismo PR)

### 2.1 Tombstone map (`src/data/exercises/retiredExercises.ts`, archivo nuevo)
`retiredExerciseIds: ReadonlyMap<string, string>` id-viejo → id-reemplazo (los 10 de arriba) +
helper `resolveRetiredReplacement(id): string | undefined`. No toca schemas.ts. Se exporta por
`src/data/index.ts`. Los motores/Biblioteca nunca ven las keys (ya no estan en el catalogo).

### 2.2 Guard duradero en render (`SessionsView.tsx` — `SessionBlockCard`)
HOY: `if (!block || !exercise) return null` (linea ~461) = el P0 exacto de W1 (bloque guardado
con id inexistente desaparece en SILENCIO del planner pero sigue en el snapshot). FIX: separar
los dos casos. `!block` sigue → null. `block && !exercise` → estado explicito "Ejercicio
retirado del catalogo" con dos acciones: **Quitar bloque** (`removeSessionBlock`) y, si hay
tombstone, **Reemplazar por <titulo>** (`updateSessionBlock(id, { exerciseId: reemplazo })`,
1 click). Cubre estos 10 y CUALQUIER id colgante futuro (import/borrado). Pieza no-negociable.

### 2.3 Borrado del catalogo
Quitar las 10 entradas de `compactCuratedSpecs`. Efecto automatico: `generatedLibraryExerciseIds`
17→7; `catalog.length` −10; `getSelectableCatalog()` NO cambia (los 10 ya estaban excluidos por
generated) → pool sigue 19; `criticalExerciseIds` 1→0 (el unico critical era #1).

Migracion de snapshot (opcion 3 del diseno) = NO se ejecuta: el guard 2.2 ya hace el sistema
seguro sin tocar datos del usuario; queda a criterio de producto para otra ola.

## 3. Conteos ANTES/DESPUES (a reportar con numeros reales del build)
- catalog total: N → N−10
- generatedLibraryExerciseIds: 17 → 7
- getSelectableCatalog() (pool visible/seleccionable): 19 → 19 (SIN cambio — los borrados eran generados)
- criticalExerciseIds: 1 → 0
- cobertura 6 fases del pool: intacta (el pool no pierde ninguna entrada)

## 4. Tests a actualizar (literales del arbol MERGEADO = origin/main 851df4c, verificado)
- `tests/exerciseQualityReport.test.ts`: (a) L11 `byId("presion-arquero-pase-atras")` → usar
  `pressing-portero-recibe` (curado con dominio pressing); (b) L47 `criticalExerciseIds` toEqual
  `["presion-arquero-pase-atras"]` → `[]`; (c) L69-76 "top-N peor incluye el ejercicio roto" →
  ya no hay roto: worst sigue <100 pero sin assert de critical/id borrado.
- `tests/reauthoredExercises.test.ts`: L57 `criticalExerciseIds` toEqual `["presion-..."]` → `[]`.
- `tests/validateExercise.test.ts`: L105-108 "cuarentena el ejercicio roto" → el id ya no existe;
  reescribir para: el id retirado NO esta en el catalogo, su reemplazo `pressing-portero-recibe`
  SI es seleccionable, y el tombstone lo mapea. L116-128 (contrato bidireccional del pool) se
  auto-ajusta (itera sobre catalog).
- `tests/quickStartHonestPool.test.ts`: colchon `>=10` intacto; sin cambios.
- Auto-ajustables (no tocar): `exerciseQualityReport` L60/L83 (self-ref a catalog.length/size),
  `catalogIdUniqueness`.

## 5. Test nuevo — persistencia no rompe (brief item 7)
`tests/retiredExercises.test.ts`: (a) las 10 keys NO estan en catalog; (b) los 10 valores SI
estan en catalog y son seleccionables; (c) una `Session` guardada con un bloque cuyo exerciseId
es retirado NO crashea `recomputeSession`/`computeSessionSummary` (se saltea, load coherente) y
el tombstone resuelve al reemplazo. mc-19 valida persistencia end-to-end sobre este branch despues.

## 6. Validacion
- `npm run type-check`, `npm run build`, `npm test -- --run` (suite COMPLETA — toco catalogo).
- Reconfirmar literales contra `git fetch origin && origin/main` fresco antes del done (leccion W3).

## Guard EOL
`git diff --stat` antes de cada commit; whole-file diff inesperado → parar + escalation.
