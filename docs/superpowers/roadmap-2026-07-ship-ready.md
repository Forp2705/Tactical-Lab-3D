# RomboIQ — Roadmap ship-ready (2026-07)

> **Qué es este doc.** No es un spec ni un plan de superpowers. Es el **brief de planificación** que alimenta el flujo. Para cada slice, Claude Code debe correr el pipeline superpowers normal: **brainstorm → write-spec (`-design.md`) → write-plan (tareas TDD) → implement**, un branch/PR por slice, como en las slices 1–4 del board. Este doc le da a cada slice el problema, el scope bloqueado, los non-goals y los hechos ya verificados contra el código, para que el spec arranque grounded y no re-derive cosas mal.

## Objetivo de la tanda

Dejar RomboIQ **ship-ready**: cerrar los gaps que harían rebotar a un coach en un piloto de 2 semanas. **Sin features grandes nuevas.** Todo lo de acá es pulido, cierre de loops ya empezados, y honestidad de producto.

## Constraints globales (aplican a todas las slices)

- **TDD estricto**, formato superpowers: test que falla → implementación mínima → verde → commit. Un branch/PR por slice.
- **Respetar los boundaries de `CLAUDE.md` §12–13.** No importar `CoachAgent.ts` en React. No exponer API keys. No escribir memoria táctica automáticamente. No romper el snapshot persistido sin migración.
- **Degradación honesta** como en el resto del repo: si la IA/red falla, estado explícito en UI, nunca un número inventado ni un fallback silencioso.
- **Cada slice compila + type-check verde + su suite de tests verde** antes de mergear.
- **No mezclar los tres sistemas de IA** (coach conversacional / post-match / knowledge-retrieval): tocar solo el que la slice nombra.

## Hechos verificados contra el código (baseline — no re-derivar)

- **Export hoy:** el board exporta **SVG** (`renderTacticalBoardSvgMarkup`) + **HTML briefing** (`exportBoard.ts`); el viewer exporta **MP4/GIF** vía ffmpeg (`src/export/media.ts`). **No existe PNG de un frame ni link compartible.**
- **Video:** `/api/video/pattern-scan` **ya existe** — manda frames base64 (cap 8) a un modelo de visión OpenAI y devuelve patrones validados con Zod (`src/video/videoPatternScan.ts`, `VIDEO_PATTERN_DEFINITIONS`). `VideoView.tsx` hoy es tagging/tracking manual; el gap es **cablear la UI a ese endpoint**, no construir análisis de cero.
- **Coach:** el firewall estructura-vs-claim (`coachOutputGuard`) ya está y tiene 32 tests verdes. Env soporta `OPENROUTER_FALLBACK_MODELS` (hay que verificar que realmente entre en runtime).
- **Tests:** `npm test` (`vitest run`) corre **verde en ~10s, incluso con una key real** — no se cuelga. (El "hang" que se reportó antes era un artefacto del sandbox de inspección, no del repo.) El tooling de IA pesado (`coach:test`, `coach:eval`, `memory:*`, `knowledge:*`) son **scripts `tsx` separados, no tests de vitest**, así que `npm test` no los toca. A verificar en la slice: si algún `*.test.ts` de eval (`coachContinuousEval`, `coachRetrievalEval`, `embeddingRetrieval`, `realCoachOnboarding`) pega a red cuando hay key presente.
- **Repo:** working tree con ~168 archivos "modificados" = churn de **line endings CRLF**, no cambios semánticos. Hay basura (`tmp-*`, zips). CLAUDE.md/AGENTS.md están desfasados (no mencionan `board`, `scout`, `sketch`, `home`, y subestiman `video`).
- **Gemini:** removido pero **preservado en `wip/preserve-2026-07-01` (commit `41a074a`)**, NO en main (main está pristine, la ruta sigue en el código). Se aterriza en Slice 0 vía cherry-pick + poda de lockfile. Camino IA objetivo = OpenRouter.

---

## Secuencia de slices

Orden por dependencia y valor/esfuerzo: **0 → A → B → C → D → E**. La 0 va primero porque habilita delegar con un CI confiable y un árbol limpio.

### Slice 0 — Base limpia + gate de CI

**Problema.** Churn de CRLF **latente** (`core.autocrlf=true` + sin `.gitattributes` → cualquier edición en Windows vuelve a ensuciar el árbol), basura trackeada, y **no hay gate de CI** que pruebe que el build shippable corre **sin red ni secrets**. (Suite ya verde y rápido — no se cuelga; descartado.) **Precondición 0 completa:** main pristine en `e5001b2`, WIP real preservado en `wip/preserve-2026-07-01` (4 commits, tip verde).

**Scope ship-ready.**
- **Line endings (DESPUÉS de borrar junk):** `.gitattributes` con `* text=auto eol=lf` **+ reglas binarias explícitas** (`*.glb *.png *.jpg *.jpeg *.gif *.webp *.ico *.woff *.woff2 *.ttf *.zip *.mp4 *.mov *.pdf` → `binary`), luego `git add --renormalize .` en un commit dedicado. Diff grande pero semánticamente vacío, one-time; después la tree queda limpia y el churn CRLF no puede recurrir. Las reglas binarias garantizan que renormalize nunca toque un `.glb`/PNG/asset. **Co-locar `biome.json` `lineEnding: lf`** en la misma unidad — `.gitattributes` y biome deben coincidir en LF o el churn vuelve (era el landmine a tres bandas).
- **Junk (PRIMERO, antes del renormalize):** `git rm` de los 20 archivos **trackeados** — `Tactical Lab 3D.zip`, `test-retrieval-tmp.ts` (vacío), `tmp-dev-server.*`, `tmp-reality-*` (incl. `tmp-reality-screens/*.png`), `tmp-weekly-trust-closure-results.json`. Es cambio explícito del repo, no limpieza de workspace. Confirmar que ninguno esté importado. `.env.local`: **verificado no-trackeado ni en historial** (sin exposición de key) — solo mantener gitignored.
- **Gemini cleanup (una unidad):** primero **cherry-pick `41a074a`** de `wip/preserve-2026-07-01` (remoción de endpoint/ruta/dep en código), luego `npm install` para podar `@google/generative-ai` del `package-lock.json`. **Diff del lockfile acotado:** que salgan solo las refs legacy de Gemini; si npm mete churn de deps no relacionadas, revertir ese churn (no aceptarlo como "cleanup").
- **Guardrail de no-red (sin relocalizar nada — YAGNI, hoy nada se cuelga):**
  - (a) Job de CI que corre `npm ci && npm run type-check && npm run build && npm test` **sin secrets inyectados**, probando que el gate shippable no necesita red ni keys.
  - (b) **Setup global de Vitest que bloquea cualquier llamada de red real** (override de `globalThis.fetch` que tira en host no-local), **con escape hatch `ALLOW_NETWORK_TESTS=1`** para evals live a propósito. `npm test` queda **offline por defecto**; cualquier test futuro que intente salir a red falla al instante. No como "un test guard" aislado, sino como setup, para que la protección sea universal. **Su unit test debe cubrir el path real:** un cliente OpenAI/OpenRouter (SDK v6, que usa `globalThis.fetch`) **stubbeado** queda bloqueado por el setup — no solo un `fetch("https://…")` crudo. Localhost pasa; con el flag, pasa.
  - **No** re-taggear ni mover evals físicamente. Si hay evals live reales, viven en scripts/commands explícitos (`coach:eval`, etc.), no reorganizados por un hang no reproducido.
- Actualizar `CLAUDE.md` y `AGENTS.md` a la estructura real (agregar `board`, `scout`, `sketch`, `home`; corregir la afirmación de que video no tiene análisis).
- **Deliverable de baseline (en el PR/spec):** dejar constancia de que *no se reprodujo hang*; el gap real era ausencia de CI para `npm test` + falta de guardrail offline. Cierra el fantasma para futuras slices.

**Precondición — VERIFICADA ✅ (ya corrió).** `CI=true npm test` sin secrets (`.env.local` movido aparte): **495 tests verde en ~7s**. Ningún workflow inyecta secrets (`coach-eval.yml` sin bloque `secrets.`/`env:`). **Cero `*.test.ts` network-capable** (todos puros o con dependency-injection; el path live vive solo en scripts). Conclusión: el guard offline es seguro de agregar — nada en `npm test` se rompe.

**Non-goals.** Refactors de código de app. Tocar lógica de negocio. Relocalizar/re-taggear los tests de eval (no hace falta: nada se cuelga).

**Boundary.** Ninguno sensible; es higiene + config de test.

**Acceptance.** Job de CI corre `npm ci && type-check && build && npm test` **sin secrets** y verde. El setup global hace fallar cualquier red viva (probado con un test que intenta `fetch` sin `ALLOW_NETWORK_TESTS=1` y debe fallar); con el flag, una eval live corre. Ninguna eval que hoy pasa queda roja. `git status` limpio salvo lo intencional. `.gitattributes` presente. Docs + nota de baseline actualizados.

**Entrada superpowers.** Slice chica: puede saltear brainstorm largo e ir directo a un plan corto TDD (los "tests" acá son "CI verde reproducible" + un check de que ningún test importa red por defecto).

---

### Slice A — Export PNG de un frame (cierra el gap #1 del benchmark)

**Problema.** Un coach necesita mandar algo a 20 jugadores en 5 minutos. Hoy todo es pull-based (abrir SVG/HTML/MP4). Falta la imagen estática de una jugada, lista para pegar en el grupo.

**Scope ship-ready.**
- Helper puro/testeable **SVG → PNG** sobre `renderTacticalBoardSvgMarkup` (rasterizar en canvas, `toBlob`), dimensiones legibles en celular (ej. ancho fijo ~1080px, ratio de cancha).
- Botón "Exportar PNG" en el board (topbar/footer) y, si es barato, en el frame actual del viewer.
- Stretch (solo si entra sin costo): "copiar imagen al portapapeles".

**Non-goals.** Link compartible / hosting (depende de persistencia server, fuera de ship-ready). Export de video nuevo. Editor de imagen.

**Boundary.** Reusar `exportBoard.ts` / `renderBoardSvg.ts`; no duplicar el render.

**Acceptance.** Un click → descarga un PNG legible en teléfono de la escena actual del board. Test del helper de rasterizado (dado un SVG conocido, produce un blob PNG de dimensiones esperadas). Falla elegante si el navegador no soporta `toBlob`.

**Entrada superpowers.** brainstorm corto (dónde vive el botón, qué escena se rasteriza) → spec → plan.

---

### Slice B — Hardening del board (la superficie más nueva)

**Problema.** El módulo `board` es lo más reciente y lo primero que toca un coach. Es el mayor riesgo de bug embarazoso en un piloto.

**Scope ship-ready.**
- Bug-bash del flujo core: empty state claro, integridad de **undo/redo** (`boardEditorReducer`), switch de herramientas sin estado colgado, pointer en tablet/touch, paridad de export (que lo que se ve = lo que se exporta, incluido el PNG de Slice A).
- Cerrar cualquier `console.error`/warning en los flujos principales.

**Non-goals.** Sketch → animación sin keyframes. Sketch → escena 3D. Herramientas de dibujo nuevas. (Todo eso es feature, no ship-ready.)

**Boundary.** `boardEditorReducer.ts`, `useBoardEditor.ts`, componentes de `board/components`. No tocar el bridge coach (ya lockeado en slice 4).

**Acceptance.** Checklist de smoke reproducible (documentado) + property tests del reducer (undo/redo es inverso, no pierde acciones). Cero errores de consola en el flujo dibujar → editar → exportar.

**Entrada superpowers.** brainstorm = enumerar los flujos core y los invariantes del reducer → spec de invariantes → plan TDD.

---

### Slice C — Fiabilidad del coach + degradación elegante

**Problema.** El coach es el diferenciador; no puede fallar feo en un piloto. Hay que probar los caminos de error, no solo el happy path.

**Scope ship-ready.**
- Verificar/forzar que `OPENROUTER_FALLBACK_MODELS` realmente se usa cuando el modelo primario falla.
- Manejo honesto de 429 / timeout / respuesta inválida: estado explícito en `AiView`, retry acotado, nunca render de número no-grounded (ya firewalled — agregar regresión que lo bloquee end-to-end).
- Dejar el eval de calibración corriendo y **reportando score** (en su job, sin bloquear `npm test`).

**Non-goals.** Streaming de respuestas (nice-to-have, no ship-ready). Nuevas capacidades del agente. Tocar post-match o knowledge-retrieval.

**Boundary.** `CoachAgent.ts` / `CoachPipeline.ts` / `coachAgentClient.ts` / `AiView.tsx`. Solo el sistema **conversacional** (CLAUDE.md §15).

**Acceptance.** Test que fuerza fallo del modelo primario → verifica fallback. Test end-to-end: claim no-grounded → UI no muestra número. Job de eval corre y emite score.

**Entrada superpowers.** brainstorm = mapear los modos de fallo reales → spec de "degradación honesta del coach" → plan TDD (tests de fallo primero).

---

### Slice D — Cerrar el loop de video semi-auto (ya está 80% server-side)

**Problema.** El endpoint de detección de patrones existe pero la UI no lo usa; el módulo video quedó a mitad de camino y la doc lo esconde.

**Scope ship-ready.**
- Cablear `VideoView` → `/api/video/pattern-scan`: muestreo de frames del clip cargado (respetar cap de 8), guarda de costo/rate-limit, y volcar los patrones detectados como **tags en el timeline** existente.
- Etiquetar la feature como **beta**, detrás de un flag, con expectativas claras (asistido, no verdad).
- Degradación honesta si el scan falla o no hay key de visión.

**Non-goals.** Tracking automático de jugadores. Análisis de video en tiempo real. Modelo propio. Reemplazar el tagging manual (coexiste).

**Boundary.** `VideoView.tsx`, `src/video/*`, `api/video/pattern-scan.ts`. No tocar coach ni post-match.

**Acceptance.** Cargar clip → correr scan → aparecen tags de patrón en el timeline. Cap de costo respetado. Falla elegante sin key. Flag beta on/off.

**Entrada superpowers.** brainstorm = UX del disparo del scan + cómo se muestran los resultados → spec → plan TDD (parser de respuesta + wiring).

---

### Slice E — Pass ligero de densidad/UX (opcional, si sobra tiempo)

**Problema.** Varias pantallas leen como "panel de instrumentos" (cockpit de AiView, PostMatch). Riesgo de rebote antes de llegar al loop semanal.

**Scope ship-ready.** Un pass puntual en las 2 pantallas más densas + empty states de primer uso. Reducir densidad y aclarar el primer paso. **No rediseñar.**

**Non-goals.** Rediseño de sistema visual. Nuevos componentes. Cambios de información.

**Boundary.** Solo capa de presentación; no tocar lógica ni contratos.

**Acceptance.** Antes/después de las 2 pantallas; primer uso muestra un empty state que dice qué hacer primero. Sin regresiones funcionales.

**Entrada superpowers.** brainstorm = elegir las 2 pantallas y los 3 cambios de mayor impacto → spec liviano → plan.

---

## Cómo delegar cada slice a Claude Code

Por cada slice, en orden:

1. Pasarle a Claude Code el brief de la slice de este doc y pedirle que corra el flujo superpowers: **brainstorm** (refinar contra el código real) → **write-spec** en `docs/superpowers/specs/AAAA-MM-DD-<slice>-design.md` → **write-plan** en `docs/superpowers/plans/AAAA-MM-DD-<slice>.md` → **implement** TDD.
2. Un branch/PR por slice. Merge solo con type-check + build + suite de la slice verdes.
3. No arrancar la siguiente slice hasta mergear la anterior (salvo 0, que va sí o sí primero).
