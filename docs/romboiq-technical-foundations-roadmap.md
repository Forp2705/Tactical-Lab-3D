# RomboIQ — Roadmap de Fundaciones Técnicas

> Eje de crecimiento elegido: **fundaciones técnicas**. No quick wins. Esfuerzo grande,
> secuenciado por dependencia y riesgo, ejecutable en fases sin romper lo que ya es sólido.
>
> Este documento es el resultado de una auditoría profunda del repo (build/tooling,
> estado/persistencia, capas de IA + boundary, dominio/type-safety/testing). Las referencias
> `archivo:línea` son el grounding de cada decisión.

---

## 0. Resumen del estado actual

### Lo que ya es sólido (no tocar sin razón)

- **Contrato de dominio (A+).** `src/data/schemas.ts` (332 líneas) modela todo el dominio en Zod
  y deriva los tipos TS con `z.infer`. Cero duplicación de tipos, cero divergencia runtime/TS.
  Importado por 26+ archivos. Schemas secundarios (`CoachSchemas.ts`, `post-match/schemas.ts`,
  `sketch/sketchSchemas.ts`, `data/gameModel.ts`) están aislados y documentados.
- **Type-safety (A).** `tsconfig` con `strict: true`. `npm run type-check` pasa con cero errores.
  Cero `@ts-ignore`. Solo 6 `as any`, todos en `src/export/media.ts` (tipos incompletos de FFmpeg).
- **Boundary server/client (limpio).** Ningún `.tsx` importa `CoachAgent.ts` ni `post-match/storage.ts`.
  Todo cliente pasa por `fetch` a `/api/...`. Secrets solo en `process.env` server-side; sin fugas `VITE_`.
- **Validación IA (completa).** Input y output validados con Zod en todos los bordes de `/api`.
- **Tests verdes.** 236/236 tests pasando, retrieval híbrido keyword+embeddings, migraciones versionadas.

### La deuda real de fundaciones

| # | Área | Problema | Severidad |
|---|------|----------|-----------|
| D1 | Store | God-store monolítico: `useAppStore.ts` = 1.910 líneas, 22 dominios, 72 acciones, acoplamiento cruzado, sin slices, sin selectores | Alta |
| D2 | Persistencia | Extracción de snapshot **duplicada** (`App.tsx` + `AppShell.tsx`); se persisten campos derivados (`session.computed`); recovery no es por-item en arrays; saves silenciosos sin debounce | Alta |
| D3 | Bundle | Dep muerta `@google/generative-ai`; SDK `openai` importado **estáticamente** en 8 módulos server-ish; `useAppStore` arrastra Dexie/`db.ts` al bundle principal solo por la constante `APP_SNAPSHOT_VERSION` | Media-Alta |
| D4 | Persistencia server-side | Deployado en Vercel (`romboiq.vercel.app`). El crash read-only ya está mitigado (`serverDataPaths.ts:12` redirige a `/tmp` bajo `VERCEL`), **pero** reports post-match y memoria táctica commiteada se escriben en `/tmp` efímero → **pérdida silenciosa de datos en prod** (cold start / instancia nueva los borra; no se comparten entre instancias) | Alta |
| D5 | CI | Solo el workflow `coach-eval` (filtrado por paths). No hay CI general (type-check + lint + test + build) en cada PR; sin cobertura; sin pipeline de deploy | Alta |
| D6 | Testing | Caminos críticos de UI/render sin tests: `Scene3D.tsx` (671), `LineupLab3D.tsx` (2.099), `useAppStore.ts`, round-trip de `db.ts`, `SessionsView.tsx`, `VideoView.tsx`. Sin E2E | Media |
| D7 | Strictness | Faltan `noUnusedLocals`/`noUnusedParameters`/`noUncheckedIndexedAccess`; Biome solo `recommended`; 543 non-null assertions sin auditar | Media-Baja |
| D8 | Dead code | Endpoint Gemini gateado pero muerto (`api/ai/gemini.ts`); declaración `VITE_ANTHROPIC_API_KEY` sin uso | Baja |

---

## Principio de secuenciación

Vamos a refactorizar el corazón de la app (store, persistencia, bundle, deploy). Eso es riesgoso
**precisamente porque hoy está poco testeado**. Por lo tanto el orden no negociable es:

> **Primero la red de seguridad, después el trabajo pesado.**

Cada fase queda detrás de tests de caracterización que congelan el comportamiento actual antes de
moverlo. Ninguna fase rompe las partes ya sólidas (dominio, boundary, validación IA).

---

## Fase 0 — Red de seguridad (habilita todo lo demás)

**Objetivo:** poder refactorar sin miedo. Sin esto, las fases 2 y 3 son temerarias.

1. **CI general en cada PR.** Nuevo workflow `.github/workflows/ci.yml`:
   `npm ci` → `type-check` → `lint` (Biome) → `test` (suite completa) → `build`.
   El `coach-eval.yml` actual queda como complemento especializado, no como única defensa.
2. **Cobertura.** Configurar Vitest coverage (`vitest.config.ts` explícito) con umbral baseline
   no-regresivo. No exigir 90% de golpe; fijar el piso en el nivel actual y prohibir bajarlo.
3. **Tests de caracterización del store.** Cubrir las acciones con acoplamiento cruzado antes de
   tocarlas: `addToSession` (`useAppStore.ts:1004`), `removePlayer` (`:1191`),
   `createSessionFromWeeklyThread` (`:1262`), `createSessionFromCoachAdvice` (`:1299`).
4. **Test de round-trip de persistencia.** `saveSnapshot` → `loadSnapshot` → estado idéntico,
   y todas las migraciones v1→v6 (`db.ts:235`). Extiende el `migration.test.ts` existente.

**Riesgo:** bajo. Solo agrega. **Desbloquea:** Fases 2 y 3.

---

## Fase 1 — Higiene de bundle y boundary (alto leverage, bajo riesgo)

**Objetivo:** bundle honesto y server-only de verdad. Prepara el terreno para deploy.

1. **Eliminar dead code (D3, D8):** quitar `@google/generative-ai` de `package.json`,
   borrar `api/ai/gemini.ts` + su ruta en `vite.config.ts`, borrar la declaración
   `VITE_ANTHROPIC_API_KEY` de `vite-env.d.ts`.
2. **Cortar Dexie del bundle principal (D3):** extraer `APP_SNAPSHOT_VERSION` a un módulo de
   constantes (`src/state/snapshotVersion.ts`) para que `useAppStore.ts:37` deje de importar todo
   `db.ts` (y con él Dexie) al bundle de arranque.
3. **`openai` estrictamente server-only (D3):** garantizar que los 8 módulos que lo importan
   estático solo se alcancen vía `await import()` desde handlers `/api`. Agregar un test/lint que
   falle si un módulo cliente importa `openai`.
4. **Presupuesto de bundle:** `manualChunks` explícito + `chunkSizeWarningLimit` en `vite.config.ts`,
   y un check de tamaño en CI que falle si un chunk supera el budget.

**Riesgo:** bajo-medio. **Depende de:** Fase 0 (CI verde como referencia).

---

## Fase 2 — Endurecer persistencia (superficie de pérdida de datos)

**Objetivo:** que un cambio de schema o un item corrupto no borre el trabajo del usuario.

1. **Fuente única del snapshot (D2):** un solo `snapshotFromState()` reusado por `App.tsx` y
   `AppShell.tsx` (hoy duplicado en `App.tsx:189` y `AppShell.tsx:325`).
2. **No persistir derivados (D2):** dejar de guardar `session.computed`; recomputar en load.
   Evita valores stale cuando cambia la lógica de cálculo.
3. **Recovery por-item (D2):** en arrays (`exerciseVariants`, `team.players`, etc.), salvar item por
   item en vez de descartar el array entero si uno falla la validación (`db.ts:451` recovery).
4. **Saves con debounce + detección de cambios + log de errores (D2):** reemplazar el
   `setInterval(8000)` ciego (`App.tsx:230`) y el fallo silencioso de `saveSnapshot` (`db.ts:377`).

**Riesgo:** medio (toca datos reales). **Depende de:** Fase 0 (round-trip test).

---

## Fase 3 — Descomposición del store (el trabajo grande)

**Objetivo:** matar el god-object sin romper la cohesión del snapshot ni la reactividad.

**Enfoque recomendado:** patrón *slices* de Zustand combinadas en **una sola** store (no múltiples
stores). Mantiene un único punto de persistencia y evita el dolor de sincronizar stores cruzados.

1. **Definir slices** por dominio: `viewer`, `library/exercise`, `layers/filters`, `team`,
   `identity/gameModel/scout`, `session`, `microcycle`, `lineupLab`, `video`
   (tags/tracks/observations), `weeklyThread`, `ai/coachInterview`, `ui/export`.
2. **Selectores tipados + memoizados** para cortar el "todo update re-renderiza a todos".
3. **Orquestación explícita** para las acciones que hoy cruzan dominios: extraerlas a funciones de
   orquestación que llaman a las slices, en vez de mutar 3 dominios en un set.
4. **Incremental:** slice por slice, detrás de los tests de caracterización de la Fase 0.
   El snapshot persistido no cambia de forma (o cambia con migración v7 mínima).

**Riesgo:** alto (corazón de la app). **Depende de:** Fases 0 y 2.

---

## Fase 4 — Durabilidad de la persistencia server-side (BLOCKER DE PRODUCCIÓN)

**Contexto real:** ya está deployado en Vercel (`romboiq.vercel.app`). El crash de filesystem
read-only ya está resuelto: `serverDataPaths.ts:12` detecta `VERCEL` y redirige los writes a
`/tmp/tactical-lab-3d`. **El problema que queda es durabilidad, no arranque.**

**El bug en producción:** `/tmp` en serverless es efímero por instancia. Hoy en prod:

- `savePostMatchReport` y `commitMemoryCandidates` (`storage.ts:33,64`) escriben en `/tmp` →
  los reports y la memoria táctica commiteada **desaparecen** en el próximo cold start o instancia.
- `loadReports`/`loadGeneratedMemory` (`storage.ts:147,170`) leen de `/tmp`, no del archivo
  seedeado en el repo → en prod arrancan vacíos en cada boot frío.
- Para el staff: commitea memoria, ve "éxito", y se evapora. Pérdida silenciosa de datos.

**Decisión de fundación a resolver:** elegir un backend de persistencia server-side durable
(Vercel Blob / KV, Postgres gestionado, Supabase, etc.) detrás de la misma interfaz de `storage.ts`,
manteniendo el seed del repo como estado inicial. Es fundación pura aunque la app siga siendo
single-user — no es el eje "multiusuario" que descartaste, pero hoy es un bug activo en prod.

**Acompaña:** documentar el flujo dev (Vite middleware) vs prod (Vercel functions) y, opcionalmente,
deploy de preview por PR en CI.

**Riesgo:** medio-alto (decisión arquitectónica + datos en vivo). **Depende de:** Fase 1.
**Prioridad real:** dado que es un bug activo en prod, candidato a adelantarse antes que las Fases 2-3.

---

## Fase 5 — Ratchet de type-safety y lint

**Objetivo:** subir el piso de calidad sin un big-bang.

1. Activar `noUnusedLocals` + `noUnusedParameters` (`tsconfig.json`).
2. Evaluar `noUncheckedIndexedAccess` (impacto grande; hacerlo gradual, archivo por archivo).
3. Auditar los 543 non-null assertions, concentrados en `src/viewer/`; reemplazar los riesgosos.
4. Endurecer Biome más allá de `recommended` (reglas de correctness/suspicious).

**Riesgo:** bajo (incremental). **Depende de:** Fase 0.

---

## Fase 6 — Tests de los caminos críticos de UI/render

**Objetivo:** cerrar los ~8.000 LOC sin tests directos en superficies de alta interacción.

1. `Scene3D.tsx` (loop de animación, sync actor/pelota), `LineupLab3D.tsx` (2.099 LOC, el mayor gap).
2. `SessionsView.tsx`, `VideoView.tsx`.
3. E2E liviano (Playwright) para los journeys críticos: abrir ejercicio → reproducir; armar shape →
   inyectar al coach; generar post-match → commitear memoria.

**Riesgo:** bajo. **Depende de:** Fase 3 (store estable facilita testear vistas).

---

## Mapa de dependencias

```
Fase 0 (red de seguridad)
   ├─► Fase 1 (bundle/boundary) ─► Fase 4 (deploy)
   ├─► Fase 2 (persistencia) ───► Fase 3 (store) ─► Fase 6 (tests UI/E2E)
   └─► Fase 5 (strictness, en paralelo)
```

## Recomendación de arranque

Hay una tensión a resolver, ahora que la app está en producción:

- **Fase 0** es el arranque correcto por disciplina: 100% aditiva, deja la métrica objetiva
  (CI verde + cobertura baseline) contra la cual medir todo lo demás. Sin la red de seguridad,
  atacar el god-store (Fase 3) o la persistencia (Fase 2) es trabajar a ciegas sobre el corazón.
- **Fase 4** es un **bug activo en prod** (pérdida silenciosa de reports y memoria commiteada).
  Si el staff ya usa el flujo post-match en `romboiq.vercel.app`, esto sangra datos hoy.

**Sugerencia:** Fase 0 primero (rápida y habilitante), e inmediatamente Fase 4 como primer trabajo
pesado, ya que es el único ítem que está causando daño en producción en este momento. El resto
(2, 3, 5, 6) sigue el mapa de dependencias.
