# PLAN — W6 mc-22: REWRITE-CARO re-autorado (ataque-cambio-orientacion-extremo)

Branch: `feat/w6-rewrite-switch` desde `origin/main` = `774cd7b` (verificado). OPCIONAL, NO
bloquea la ola. Mismo estandar/metodo que W3/W5 (re-autorar la ESCENA, id conservado).

## Veredicto de entrada (adjudicado por mc-10 en W5)
Re-autorar SOLO si la escena puede mostrar ATRACCION REAL del bloque rival antes del switch:
cancha completa, ~10-12 actores, un bloque que se CORRE hacia la banda fuerte y deja al
extremo del lado debil en 1v1 con ventaja. Ese costo es lo que lo hacia CARO. Si la atraccion
no se puede contar con el presupuesto del formato, PARAR y reportar "sigue CARO".

## Resolucion del veredicto (medida contra el codigo)
El formato SI soporta el costo: `SceneSchema.actors` es `z.array` sin cap, `pitchMode` incluye
`"full"`, y el salvage W5 `presion-salto-lateral` ya usa `full` + 9 actores + un bloque que
bascula (keyframes) disparado por un trigger. El costo es de AUTORIA (mi esfuerzo), no una
limitacion del modelo. Por lo tanto: SE RE-AUTORA. La atraccion es contable con 11 actores.

## Escena (historia que debe leerse sin texto, en una reproduccion)
- Banda fuerte (y alto): circulacion propia (DFC→LAT→INT→PIV) que FIJA y hace bascular al bloque.
- Bloque rival (4 actores: 2 DFC + MC + LI) se CORRE hacia y alto entre t3-t6 (keyframes) — la
  atraccion real, no estatica.
- Lado debil (y bajo): extremo propio (EI) aislado 1v1 contra el unico rival que NO bascula (LD).
- El switch: pase largo diagonal PIV→EI cruzando la cancha (ball path con z alto = balon aereo).
- EI recibe con ventaja corporal (carrera lanzada) y ataca el 1v1 hacia zona objetivo.
- Trigger: `closedLateral` del MC rival (se cierra a la banda) abre el cambio; activa switch+carrera.

## Presupuesto
- 11 actores: 6 own (DFC, LAT, INT, PIV, MP, EI) + 5 rival (LD aislado, 2 DFC, MC, LI).
- `pitchMode: "full"`, duracion 13, 5 overlays (3 pass incl. el switch, 1 cover=bascula, 1 run),
  1 zona (1v1 con ventaja), 1 trigger. players min 8 / max 12.

## validateExercise → score 100, critical=false
- Dominio attackOrg = `attack` (texto tiene "aislad"). EI = rol attacker (`ei`/`extrem`). Overlays
  pass+run = forward intent. own+rival presentes. Metadata completa. NO mencionar
  arquero/portero/guardameta en title/principle/objective (dispara `checkKeeperPressing`).

## Mecanica (igual que W5)
- Quitar el unico spec de `compactCuratedSpecs` → array VACIO → `generatedLibraryExerciseIds` 1→0.
- Agregar el `Exercise` curado completo al final de `extraExercises` con la MISMA id.
- Pool 25→26 (attackOrg 8→9). catalog total 26 sin cambio (se mueve de specs a extraExercises).

## Tests a tocar (asserts que asumian cuarentena size 1)
- `reauthoredExercises.test.ts`: B5 pool 25→26; S4 cuarentena `[...]`→`[]` (vacia). Agregar bloque
  W6 (mismo contrato S1-S3) para el re-autorado.
- `quickStartHonestPool.test.ts`: el `it` "acepta un generado no critico" (l.51-58) asume que hay
  un id en la cuarentena — con cuarentena vacia `find` da undefined y `toBeDefined()` rompe.
  Reescribir preservando el contrato: cuarentena vacia + `isSelectableExercise` sigue aceptando un
  id referenciado fuera del pool visible (retirado no-critico) = sesiones guardadas reproducibles.
- `validateExercise.test.ts` l.132-150: es by-id (excluded = criticos ∪ generados), robusto con
  cuarentena vacia. No tocar.

## Verificacion
- `npm run type-check`, `npm run build`, `npm test -- --run` (completa).
- Visual: abrir el ejercicio en el visor 3D (top+iso) — el switch y la bascula del bloque se leen
  sin texto (metodo W2/W3/W5).
- Literales de conteo contra `origin/main` FRESCO (soy el unico branch de catalogo esta ola).

## Guard EOL / commits
`git diff --stat` antes de cada commit; whole-file diff inesperado → parar + escalation.
Commits granulares (escena / mecanica-specs / tests). NUNCA push. Espera gate mc-10.
