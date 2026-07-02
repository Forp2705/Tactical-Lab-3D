# PLAN — FIX 5: Contexto del coach integro y visible (OPT2-acotada)

Branch: `fix/w1-coach-context` (desde `origin/main` = `1bad717`).
Decision del coordinador (msg_a38b84a6c704): **OPT2-acotada** — reenviar el rival al campo YA EXISTENTE `coachShapeContext.rivalReference` (sin tocar tipos compartidos), para que el flujo vivo "publicar shape" lleve el rival independientemente del toggle visual, y el resumen en Diagnostico lo reporte.

## Contexto verificado (por que el scope incluye TeamView.tsx)
- `src/team/LineupLab3D.tsx` es codigo muerto (no se importa ni se renderiza; `App.tsx` monta `TeamView` para `view=team`). Su bug de rival (`:427` `showRival ? rivalChips : []`) NO tiene efecto en runtime. Se corrige igual por correctitud y por scope literal del brief.
- La "Evolucion" viva es `src/team/TeamView.tsx`. `publishShape()` -> `coachContextFromShape()` NO setea `rivalReference` -> hoy el rival nunca llega al coach.
- El rival en TeamView es un overlay decorativo hardcodeado: 4 posiciones de referencia fijas (70/50, 80/30, 80/70, 88/50), sin modelo de datos ni identidad, con toggle `showRival` (default true). La PRESENCIA es real; la identidad por-rival es un placeholder estructural, no un claim tactico.
- `coachShapeContext` NO se persiste y ya nada lo pone en null (LineupLab3D desmontado), asi que tras `publishShape` sobrevive hasta AiView.

## Cambios (3 archivos, minimos)

### 1. src/team/TeamView.tsx
- Extraer las 4 posiciones inline del overlay rival a un const de modulo `RIVAL_REFERENCE_POSITIONS` (fuente unica; el overlay JSX lo sigue usando, aun gateado por `showRival` SOLO para lo visual).
- En `coachContextFromShape()`: poblar `rivalReference` desde `RIVAL_REFERENCE_POSITIONS` SIEMPRE (independiente del toggle), mapeado a `CoachRivalReference {id, num, role:"RIV", x, y}`. Sin cambio de firma, sin campo nuevo de store, sin cambio de tipo compartido (`rivalReference` ya existe en `CoachShapeContext`).
- Efecto: `publishShape()` emite un `coachShapeContext` cuyo `rivalReference` refleja la referencia rival del tablero sin importar `showRival`.

### 2. src/ai/AiView.tsx
- Agregar un resumen SIEMPRE visible (1-2 lineas) dentro de `.ai-command-card` (cerca de la caja de pregunta), construido SOLO desde campos reales:
  - `activeShapeName = coachShapeContext?.selectedShapeName ?? lineupLabShapes[0]?.name ?? null`.
  - Con shape (`activeShapeName` truthy): nombre del shape; formacion (`coachShapeContext?.formation`, solo si existe); plantel disponible `N/M` (`availablePlayers`/`teamPlayers.length`); rival presente si/no (`(coachShapeContext?.rivalReference?.length ?? 0) > 0`, solo si hay `coachShapeContext`).
  - Sin shape (`activeShapeName` null): "Sin shape activo" + boton "Ir a Evolucion a publicar un shape" -> `useAppStore.getState().setView("team")` (patron ya usado en el archivo).
- El `<details>` "Avanzado" queda igual.
- Cero claims tacticos fabricados: solo nombres/conteos/booleanos de estado.

### 3. src/team/LineupLab3D.tsx (codigo muerto, scope literal)
- `:427` `rivalChips: showRival ? rivalChips : []` -> `rivalChips` (siempre). Quitar `showRival` (ya no referenciado) del array de deps de ese effect.

## Fuera de scope / no se toca
`CoachAgent*`, `CoachAgentPrompt`, `CoachSchemas`, tipos/store, `db.ts`. Sin campos nuevos en `CoachShapeContext`. Sin push, sin PR (merge lleva gate mc-99 del coordinador).

## Validacion
- `npm run type-check && npm run build && npm test -- --run` (suite completa) + `npm test -- --run tests/coach*.test.ts` (grep-verificar cobertura de `buildCoachShapeContext`/context).
- En vivo (`npm run dev`, sin key): (1) Evolucion: rival visible, apagar toggle, publicar shape, abrir Diagnostico -> el resumen sigue reportando rival presente. (2) Sin shape -> CTA visible y navega a Evolucion. (3) Publicar shape -> resumen muestra shape/formacion/plantel reales.
- Guard EOL: `git diff --stat` antes de cada commit (autocrlf=true + eol=lf: los flips puros de EOL no diffean; confirmar que solo cambian las lineas buscadas). Commits atomicos locales.

## Riesgos residuales
- El rival de TeamView es un mock decorativo (posiciones fijas, identidad placeholder); el resumen afirma solo PRESENCIA (verdadera). Si mas adelante aparece un modelo real de rival/scout, cablear `rivalReference` a el.
- `coachShapeContext` no persiste: tras un reload con shape persistido pero sin re-publicar, el resumen puede mostrar nombre desde `lineupLabShapes` sin formacion/rival (context null). Documentado, no corregido (store fuera de scope).
