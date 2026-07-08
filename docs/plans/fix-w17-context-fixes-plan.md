# Plan — W17 fase 2 fix/w17-context-fixes: fixes REGION CONTEXTO (mc-21)

## Alcance
Solo `src/ai/AiView.tsx`, region contexto (marcada `W17 REGION CONTEXTO (mc-21)` en 2 lugares:
`ContextStrip` antes del textarea, `ActiveContextPanel` en el rail "Avanzado") + el snapshot local
de lo enviado. Prohibido: `CoachAgent`, prompts, retrieval, memoria, `api/`, `coachAgentClient.ts`,
`CoachSchemas.ts`, `useAppStore.ts`. mc-17 trabaja en paralelo en la REGION RESPUESTA (error card +
entrevista + advice/empty, lineas ~456-491) del mismo archivo — no tocar esas lineas.

## Fixes (de W17-CONTEXT-AUDIT.md, H1/H2/H3/H4 propios + H4 de mc-17 absorbido)

### 1. Scout visible (H1)
- Leer `opponentScout` del store (`useAppStore((s) => s.opponentScout)`) — solo lectura, no toca
  `useAppStore.ts`.
- Importar `hasOpponentScoutData` desde `@/scout/opponentScout` (permitido, no esta en la lista
  prohibida).
- `ContextStrip`: agregar token SIEMPRE presente (nunca omitido) — `Rival: <rival> · <sistema>` si
  `hasOpponentScoutData`, si no `"Sin scout de rival"`.
- `ActiveContextPanel`: fila espejo `ContextRow label="Scout rival" value=...` con el mismo criterio.

### 2. Desambiguar el chip de `rivalReference` (H2)
- Renombrar el token de `rivalInContext` en `ContextStrip` de "Rival presente"/"Sin rival en el
  contexto" a "Referencia visual rival presente"/"Sin referencia visual rival" — para que nunca se
  lea como el scout.

### 3. Observacion visible (H4 propio)
- `ActiveContextPanel`: ademas del `ContextRow` de conteo existente, agregar bloque tipo
  `RecentReportsPanel` (clases `ai-mini-list`/`ai-mini-item` ya existentes, sin CSS nueva) con el
  TEXTO de la observacion mas reciente (`manualObservations[0]`, ya viene mas-reciente-primero por
  como `addManualObservation` hace unshift en el store).

### 4. Chip pizarra activa (H3, decision ya aprobada en version minima)
- Leer `tacticalBoards` y `activeBoardId` del store (campos YA EXISTENTES, `useAppStore.ts:353-354`
  — no se agrega ningun campo).
- `activeBoard = activeBoardId ? tacticalBoards.find((b) => b.id === activeBoardId) : null`.
- Token SIEMPRE presente en `ContextStrip`: `"Pizarra: <title> · N escenas"` si hay activeBoard,
  si no `"Sin pizarra activa"`. Fact puro (`title`/`scenes.length` del schema existente
  `TacticalBoardSchema`), sin fusionar packets ni tocar boardEvidencePacket/boardFactPresentation.

### 5. Snapshot de lo enviado (H4 de mc-17, absorbido)
- Nuevo estado local `sentContextSnapshot` (useState) en `AiView()`.
- Helper puro `buildSentContextSnapshot(...)` (nueva funcion en la seccion contexto) que arma un
  resumen contable: shape si/no + nombre, formacion, N disponibles/total, scout si/no + rival,
  N observaciones, N reportes recientes. Mismos campos/valores que YA se usan en `ContextStrip`/
  `cockpitContext` — no cambia que viaja, solo lo congela en un snapshot al momento de la consulta.
- Se llama UNA vez, al inicio de `runCoachAgent` (unico punto que cubre las 3 vias de disparo:
  boton "Consultar Coach", `submitInterviewAnswers`, `skipInterviewAndRunHypothesis` — las 3 llaman
  a `runCoachAgent`), justo despues de leer `runtimeState`. Es la unica forma de cubrir las 3 vias
  sin triplicar logica; no toca las lineas JSX marcadas como REGION RESPUESTA de mc-17.
- Render: nueva seccion pequena INMEDIATAMENTE ANTES del comentario `W17 REGION RESPUESTA (mc-17)`
  (justo despues de `<WeeklyDecisionCard />`), reusando clases `ai-context-strip`/`ai-context-chip`
  ya existentes (sin CSS nueva). Solo se muestra si `sentContextSnapshot` no es null (es decir,
  despues de la primera consulta).

## Reglas de honestidad (propia doctrina, W17-CONTEXT-AUDIT.md H5/H6)
- Ningun campo se omite en silencio: scout y pizarra SIEMPRE muestran un token, aunque sea el
  "sin X".
- Ningun texto nuevo afirma que el coach "vio" algo que no viaja — el snapshot etiqueta reportes
  como "Reportes recientes: N" (no "enviados"), ya que esos llegan via retrieval server-side, no
  en el payload (confirmado en `buildCoachRuntimeContext`, que no incluye reports).
- Sin JSON crudo, sin ids internos visibles.

## Tests
- Test puro para `buildSentContextSnapshot` (funcion nueva, logica derivada) — casos: con scout/sin
  scout, con shape/sin shape, con pizarra/sin pizarra.
- Suite completa (`npm test -- --run`) al cierre, sin tocar otros archivos.

## Validacion
1. `npm test -- --run` completa.
2. `npm run type-check`.
3. `npm run build`.
4. Vivo: demo (scout W13 "Atletico Norte" visible, observacion con texto visible, pizarra si existe
   una activa), real vacio (todo en "sin X" explicito), con/sin pizarra activa. Captura 1366.

## Commits
1. Plan (este archivo).
2. Implementacion + test, en `fix/w17-context-fixes` (stacked sobre mc-18 @ 2a3eca0). Sin push.
