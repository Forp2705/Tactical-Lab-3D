# PLAN — W3.2 mc-22: re-autorado de 3 ejercicios (Brief B + SRD)

Branch: `feat/w3-reauthor-exercises` desde `origin/main` = `4ec67c4`. Gobernado por Brief B (B1-B5) de mc-10 + mi top-3 salvage de W3.1.

## Mecánica (misma id = cero rotura de sesiones guardadas)

Los 3 ejercicios conservan su `id` EXACTO: se elimina su spec de `compactCuratedSpecs` (dejan de ser generados/ocultos) y se agrega el ejercicio curado completo al final de `extraExercises`. Resultado automático: `generatedLibraryExerciseIds` 20→17, `getSelectableCatalog()` 15→18 (B5), sesiones guardadas que referencien estas ids resuelven al contenido NUEVO (upgrade silencioso, no rotura). `criticalExerciseIds` no crece (B5) — verificado por test.

## Los 3 (escena que cuenta la historia del título)

### 1. `abp-defensa-zona-rechace` — ABP defensiva protegiendo rechace (abpDef, third)
Corner rival contra nuestro arco (+x, el que Pitch3D dibuja). Historia en 3 tiempos: (i) corner al área con dos atacantes atacando primer/segundo palo; (ii) el central más cercano ATACA el primer contacto y despeja al frontal; (iii) la segunda jugada: el pivote propio, que nunca defendió dentro, anticipa el rechace ante el llegador rival y saca la salida. GK propio en zona (x≥82) — OJO validator: el título/objetivo NO menciona "arquero" para no activar `checkKeeperPressing` (que exigiría press dirigido al GK — semántica de OTRO dominio); el GK presente satisface `checkSetPieces`. Zona "rechace" en el frontal, runs rivales a los palos, covers propios al primer contacto y al rechace, lineBlocked al llegador, trigger `badControl` en el despeje (nace la segunda jugada).

### 2. `transicion-perdida-cinco-segundos` — Perdida y presion de cinco segundos (transDef, half)
Historia: posesión propia real (pase visible en fase Ejecución — el helper `phases` oculta overlays del setup, así que la jugada arranca en t≈4), pérdida por interceptación rival del pase interior (trigger `badControl` del pasador propio), y una ventana de CINCO segundos de contrapresión: primer salto del más cercano, segundo salto, cierre de la línea de pase vertical (lineBlocked del pivote) y cobertura del pase atrás; recuperación dentro de la ventana. Zona "5 segundos" alrededor del punto de pérdida.

### 3. `repliegue-temporizar-banda` — Repliegue temporizando en banda (transDef, half)
La contracara táctica del anterior (por eso ambos, no uno): cuando NO se puede robar, se temporiza. Rival conduce por banda (overlay `dribble`); el lateral propio NO entra: acompaña orientando fuera (press "temporiza sin entrar"); el pivote cierra el canal interior (lineBlocked al 9 rival); el interior vuelve en carrera (cover "llega la ayuda"); trigger `closedLateral` cuando llega el 2v1 y recién ahí se cierra. La pelota termina forzada hacia atrás: contra frenada sin quite.

**Estándar por ejercicio (B1-B3):** score ≥80 sin tags de error via `validateExercise` (GK+overlays en setPieces; ambos equipos+reacción en transDef; metadata completa: objective, ≥2 coaching, success, players válidos, sin refs rotas), duración/espacio/material realistas, ≥2 coaching points, oposición real. B4 (firma semántica) la da coordinador+usuario en el gate.

## Tests
- Asserts de conteo del pool: 15→18 (contrato nuevo legítimo, DECLARADO — mismo patrón W1). Afecta: `tests/quickStartHonestPool.test.ts` (colchón ≥10 no cambia; sin conteo exacto) y cualquier assert de pool exacto; `tests/validateExercise.test.ts` usa fórmula (catálogo − excluidos), se ajusta sola al achicarse el set generado.
- Test nuevo dentro de los existentes NO — agrego asserts B1/B5 en `tests/quickStartHonestPool.test.ts`?? No: archivo nuevo `tests/reauthoredExercises.test.ts` (B1: los 3 con critical=false y score≥80 sin error tags; B2: fuera de generatedLibraryExerciseIds y dentro del pool; B3: el set de fases del pool incluye abpDef; B5: pool=18 y criticalExerciseIds sin crecer).
- Suite completa + type-check + build.

## Validación en vivo
Los 3 abiertos en el visor (top e iso): la escena cuenta el título sin leer texto. Quick Start "Nos contragolpean" corrido 2 veces → los bloques ahora incluyen variedad transDef nueva (antes repetía siempre el mismo curado). Biblioteca los muestra (18 visibles). Screenshots en worktree: `w3r-abp-rechace-top.jpeg`, `w3r-perdida5s-top.jpeg`, `w3r-repliegue-top.jpeg` (+iso del ABP).

## Deletion path (ENMIENDA — diseño, ejecución en ola 4)

**Qué pasa hoy si un id desaparece del catálogo:** los bloques guardados lo resuelven con `catalog.find(...)` y ante `undefined` se SALTEAN en silencio (SessionsView:444/930 y `recomputeSession` lo omiten): el bloque desaparece de la UI sin aviso pero sigue en el snapshot — la clase exacta del P0 de W1 (contenido fantasma silencioso). `getExerciseById` en App.tsx cae a `catalog[0]` (peor: muestra OTRO ejercicio).

**Propuesta segura (combinada, en orden):**
1. **Guard duradero en render** (`SessionBlockCard`/SessionsView + viewer fallback): un bloque cuyo `exerciseId` no resuelve renderiza un estado explícito "Ejercicio retirado del catálogo" con acción "Quitar bloque" o "Reemplazar por equivalente" — cubre estos 10 y cualquier borrado/import futuro. Es la pieza no-negociable.
2. **Tombstones con redirect**: cada uno de los 10 DELETE tiene un casi-duplicado curado (por eso son DELETE). Mapa estático `retiredExerciseIds: Map<id, replacementId>` en `src/data/exercises/` — el guard de (1) lo usa para ofrecer el reemplazo 1-click; los motores/Biblioteca nunca los ven.
3. **Migración de snapshot (opcional, última)**: en `loadSnapshot`, re-mapear ids retiradas al reemplazo con nota en el bloque ("reemplazado automáticamente"). Solo si producto quiere migración silenciosa; el guard de (1) ya hace el sistema seguro sin tocar datos del usuario.

Ejecución ola 4: primero (1)+(2) en un PR chico, borrar los 10 del catálogo en el MISMO PR (el guard ya está), (3) a criterio de producto.

## Guard EOL
`git diff --stat` antes de cada commit; whole-file diff → parar + escalation.
