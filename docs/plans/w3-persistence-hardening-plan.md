# PLAN — test/w3-persistence-hardening (mc-19 W3: backup-on-corruption + id duplicado)

Base: `origin/main` @ `4ec67c4`. Timebox ~40 min. No push.

## T1 — Test de backup-on-corruption contra el contrato REAL de src/state/db.ts

Contrato leido en `src/state/db.ts` (sin modificarlo):

- `loadSnapshot(key)`: lee la fila cruda de `db.snapshots`. Calcula
  `needsRecovery = !AppSnapshotSchema.safeParse(raw).success` y
  `needsMigration = rawVersion !== APP_SNAPSHOT_VERSION`. Si cualquiera de las
  dos es true, llama `backupSnapshot(key, raw)` ANTES de intentar parsear/migrar,
  y `backupSnapshot` guarda el `raw` sin tocar bajo la key `backup:<key>`
  (best-effort, silencioso si falla). Despues devuelve `parseSnapshot(raw)`.
- `parseSnapshot`: si el shape completo parsea, devuelve `migrateSnapshot(...)`;
  si no, devuelve `recoverSnapshot(...)` (rescate campo por campo, `null` si no
  se salva nada).
- `loadBackupSnapshot(key)`: lee `backup:<key>` y devuelve el `value` crudo tal
  cual se guardo (sin migrar ni recuperar).

Esto NO esta cubierto hoy: `tests/snapshot.test.ts` y `tests/migration.test.ts`
solo ejercitan `parseSnapshot` en aislamiento (le pasan el objeto directo en
memoria). Ningun test hoy escribe un snapshot corrupto/legacy directo en Dexie
y verifica que `loadSnapshot()` dispara el backup y que `loadBackupSnapshot()`
devuelve el crudo original. Ese es el gap real (H1 de auditoria mc-20).

**Test nuevo:** `tests/snapshotBackupRecovery.test.ts`, mismo patron que
`tests/snapshotRoundtrip.test.ts` (FIX 2c): `fake-indexeddb/auto` importado
antes que `src/state/db` (Dexie se instancia a nivel de modulo), `db.snapshots`
poblado directamente via `db.snapshots.put(...)` para simular datos ya
guardados por una version anterior o corrompidos (no via `saveSnapshot`, que
valida antes de guardar y nunca dejaria pasar algo invalido).

Casos:
1. **needsMigration** (snapshot legacy con `version` vieja pero shape valido):
   `loadSnapshot()` migra y devuelve version actual; `loadBackupSnapshot()`
   devuelve el crudo legacy exacto (version vieja, sin migrar).
2. **needsRecovery** (un campo con shape invalido, ej. `team` roto):
   `loadSnapshot()` rescata los campos sanos (via `recoverSnapshot`) y descarta
   el roto; `loadBackupSnapshot()` devuelve el crudo corrupto exacto (no la
   version parcialmente rescatada).
3. **sin campos reconocibles**: `loadSnapshot()` devuelve `null` pero el backup
   igual se preserva (para que un futuro intento de recuperacion manual tenga
   de donde partir).

Si alguno de estos casos resultara no-testeable sin tocar `src/state/db.ts`:
escalation antes de tocarlo. (Resultado: no hizo falta, el contrato ya expone
`db`, `loadSnapshot`, `loadBackupSnapshot`, `APP_SNAPSHOT_VERSION` — mismo set
que uso FIX 2c.)

## T2 — Id duplicado `defensa-centro-lateral`

Investigacion (`src/data/exercises/catalog.ts`):

- Ocurrencia 1 (linea ~903): dentro de `extraExercises` (array curado a mano,
  lineas 40-1582). Exercise completo: `phase: "abpDef"`,
  `principle: "defender area + rechace"`, escena con actores/triggers propios.
  Defensa de un centro lateral **en jugada de ABP** (balon parado).
- Ocurrencia 2 (linea ~2421): dentro de `compactCuratedSpecs` (lineas
  2349-2491), specs compactos que `compactCuratedExercises()` expande
  algoritmicamente a Exercise completo. `phase: "defenseOrg"`,
  `principle: "defensa del area"`, foco "Central ataca centro, lateral cierra
  segundo palo y pivote rechace" — defensa de un centro lateral **en juego
  abierto**, no ABP.
- **No son duplicado exacto de contenido**: fase distinta (`abpDef` vs
  `defenseOrg`), principio distinto, contexto tactico distinto (balon parado
  vs. juego abierto). Comparten el mismo `id` y (por copy-paste) el mismo
  `title`. Conclusion: la ocurrencia 2 es un ejercicio legitimo y distinto que
  quedo con un id colisionado, no un duplicado a borrar.
- **Impacto verificado**: `rawExercises.push(...extraExercises,
  ...compactCuratedExercises())` — `extraExercises` se concatena ANTES que
  `compactCuratedExercises()`, y `catalog = validateCatalog(rawExercises)`
  preserva ese orden. Cualquier `catalog.find(e => e.id === id)` (o `.find` en
  `SessionsView.tsx`, `useAppStore.ts`, etc.) siempre resuelve a la ocurrencia
  1 (abpDef). La ocurrencia 2 (defenseOrg) es hoy 100% inalcanzable por id —
  nunca fue servida a ningun flujo, ninguna referencia guardada (sesiones,
  variantes) pudo apuntar a ella via id porque el lookup jamas la devolvio.
  Cambiar su id no rompe ninguna referencia existente porque nunca se resolvio.
- Nota preexistente: `tests/validateExercise.test.ts:116-120` ya documenta este
  duplicado en un comentario ("aparece dos veces en compactCuratedSpecs" — en
  rigor una ocurrencia esta en `extraExercises`, no en `compactCuratedSpecs`;
  el comentario es impreciso pero el workaround que protege sigue siendo
  correcto). Ese archivo es de `validateCatalog`/`getSelectableCatalog`
  (dueno mc-22, fuera de scope): no se toca. El comentario queda stale despues
  de este fix (ya no hay id duplicado) pero el test en si sigue en verde sin
  cambios porque su logica no depende de la unicidad.

**Fix minimo:** renombrar el `id` de la ocurrencia 2 (compactCuratedSpecs, la
generada) a `defensa-centro-lateral-juego-abierto` — unico, descriptivo,
distingue explicitamente de la version ABP. Un solo campo tocado, ningun otro
campo ni orden de array. `generatedLibraryExerciseIds` se recalcula solo
(deriva de `compactCuratedSpecs.map(spec => spec.id)`), sin tocarlo aparte.

**Test nuevo:** `tests/catalogIdUniqueness.test.ts` — sobre `catalog` (export
final, ya validado), afirma que todos los ids son unicos (via `Set` vs
longitud del array) y falla con un mensaje que liste los ids repetidos si
alguna vez se reintroduce una colision.

## T3 — Round-trip sigue verde

```
npm test -- --run tests/snapshotRoundtrip.test.ts tests/snapshot.test.ts tests/migration.test.ts
npm test -- --run
npm run type-check
npm run build
```

## Scope estricto

- `tests/snapshotBackupRecovery.test.ts` (nuevo)
- `tests/catalogIdUniqueness.test.ts` (nuevo)
- `src/data/exercises/catalog.ts` — SOLO el campo `id` de la ocurrencia 2
  (linea ~2421)
- NO se toca `src/state/db.ts`, `validateCatalog`, `tests/validateExercise.test.ts`.

## Commits

1. Este plan (antes de codigo).
2. T1 (test backup-on-corruption).
3. T2 (fix id + test de unicidad).
