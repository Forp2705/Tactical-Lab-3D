# Plan — W13 feat/w13-demo-scout-seed: seed demo opponentScout + observacion

## Objetivo
Demo debe sembrar `opponentScout` (rival "Atletico Norte") y una `manualObservation`
por-workspace, para que el masthead/papel de Inicio calcen con `W9-MOCKUP-HOME.png`.
Real permanece honesto (default scout, 0 observaciones). Contrato: 3 tests RED en
`tests/realWorkspaceDemoIsolation.test.ts` (bloque W13).

## Estado verificado (RED)
`npx vitest run tests/realWorkspaceDemoIsolation.test.ts` → 3 failed / 11 passed
sobre c83cfe2, exactamente como describe el brief.

## Cambios en `src/state/useAppStore.ts`

1. Nueva const `DEMO_OPPONENT_SCOUT: OpponentScout` cerca de los otros seeds
   (junto a `seededTeam`/`createSeededLineupLab`, ~L684-717):
   - `rival: "Atletico Norte"` (sin tilde)
   - `probableSystem: "4-2-3-1"`
   - `pressing: "Presion alta tras perdida"`
   - `vulnerabilities: ["Espalda de los interiores cuando saltan a presionar"]`
   - resto de campos string vacios, arrays vacios
   - `updatedAt: "2026-06-01T12:00:00.000Z"`
2. Nueva const `DEMO_MANUAL_OBSERVATION` (o inline) con:
   - `id: "obs-demo-1"`
   - `teamId: seededTeam.id`
   - `text: "El 6 queda solo entre lineas"` (28 chars, entra en el clamp de 48)
   - `createdAt: "2026-06-01T12:00:00.000Z"`
   - `source: "home"`
3. `createRealWorkspaceState()`: agregar `opponentScout: DEFAULT_OPPONENT_SCOUT`
   (mantiene `manualObservations: []` ya existente).
4. `createDemoWorkspaceState()`: agregar `opponentScout: DEMO_OPPONENT_SCOUT` y
   cambiar `manualObservations: [] as ManualObservation[]` por
   `manualObservations: [DEMO_MANUAL_OBSERVATION]`.
5. Quitar el `opponentScout: DEFAULT_OPPONENT_SCOUT` top-level del init del store
   (~L826) — ya lo provee el spread de `createRealWorkspaceState()` en el init
   (~L803), mismo patron que `lineupLab` en W12.

## Guardas (no tocar)
- `PILOT_DIAGNOSIS_PROMPT` / `inferWorkspaceModeFromSnapshot` (~L785) intactos.
- `loadSnapshot` (~L1730) intacto — ya normaliza `opponentScout` desde snapshot.
- `staffProfile` sigue top-level, fuera de create*WorkspaceState.
- No modificar `tests/pitchSideMode.test.ts` (arranca de real/default).

## Validacion
1. `npx vitest run tests/realWorkspaceDemoIsolation.test.ts` → 14/14 verde.
2. `npm test -- --run` completa (base 689 → 692 tests).
3. `npm run type-check`
4. `npm run build`
5. EN VIVO (dev server, perfil IndexedDB nuevo): chooser → Explorar demo →
   masthead "VS ATLETICO NORTE" clickable + chip + anotacion coral en el papel;
   "Pasar a equipo real" → fallback + 0 observaciones + tablero vacio; volver a
   demo restaura todo; reload en demo persiste (via loadSnapshot).
6. Documentar en el done-report si Diagnostico demo cambia de rama sin-scout a
   con-scout (bonus a observar, no a implementar de mas).

## Commits
1. Tests + implementacion juntos (TDD ya escrito, se commitea con el fix).

Sin push — branch queda lista para gate del coordinador.
