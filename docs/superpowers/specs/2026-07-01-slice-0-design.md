# Slice 0 — Base limpia + gate de CI + guard de red offline

**Fecha:** 2026-07-01
**Roadmap:** RomboIQ ship-ready (2026-07) — Slice 0 (va primero, habilita delegar con CI confiable)
**Branch/PR:** `feat/slice-0-clean-base-ci` (un branch, un PR)
**Modo:** guardrail-only. No mover tests, no separar evals, no tocar lógica de coach/post-match/knowledge.

---

## 1. Problema

No se puede delegar a Claude Code con confianza sin una señal verde reproducible y un árbol limpio:

- El working tree muestra ~49 archivos "modificados" que son **churn de CRLF**, no cambios semánticos (`git diff api/_utils.ts` → `LF will be replaced by CRLF`, 2/2 en un archivo chico). No hay `.gitattributes`.
- Hay **20 archivos de basura trackeados** (`tmp-*`, `test-retrieval-tmp.ts`, `Tactical Lab 3D.zip`, `tmp-reality-screens/*.png`).
- `@google/generative-ai` ya no está en `package.json` pero quedan **3 referencias en `package-lock.json`**.
- **No existe un workflow de CI que corra `npm test`.** Solo hay `coach-eval.yml` (corre `coach:eval` + una lista de tests a mano, sin secrets).
- `CLAUDE.md` y `AGENTS.md` están desfasados: no mencionan `board`, `scout`, `sketch`, `home`, y subestiman `video`.

### 1.1 Hallazgo que corrige el brief (importante, no re-derivar)

El brief original decía que "el suite completo se cuelga porque algunos evals de coach esperan red". **Eso NO se reprodujo.** Verificado localmente:

- `vitest run` completo = **81 files / 495 passed / 3 todo en ~7–10s**, tanto con keys vacías como con `OPENROUTER_API_KEY` real (73 chars) presente en `.env.local`.
- Los tests de coach loguean `durationMs:1`, `attempts:1`, `fallbackUsed:false` → **no hacen llamadas live** ni con key presente.
- `CI=true npm test` con `.env.local` movido aparte y sin secrets → **495 passed, ~7s, verde**.
- Ningún workflow inyecta secrets (`grep secrets.` en `.github/workflows/` → nada).
- Los `*.test.ts` "network-capable" resultaron **puros o con dependency injection**: `buildCoachPipelineTrace` (puro), `runDeterministicCoachEval` (determinista), `embeddingRetrieval` usa `fakeEmbeddingProvider`, `coachRetrievalEval` usa `inferDomainsFromText` (puro), `coachEvalScoring` (scoring puro), `videoPatternScan` (testea el parser, no el scan live). El camino de red vive solo en **scripts** (`scripts/runCoachEval.ts` vía `coach:eval`, `testCoachAgent.ts`), no en el suite.

**Conclusión:** el gap real no es un hang; es **falta de CI completo + falta de garantía de que el suite se mantenga offline**. El diseño se hace alrededor de eso, no de un hang inexistente.

---

## 2. Objetivo y no-objetivos

### Objetivo
Dejar el repo con: árbol limpio y sin churn de CRLF recurrente, lockfile sin restos de Gemini, un guard de red que mantiene `npm test` offline por defecto, un CI principal que corre type-check + build + test sin secrets, y docs de baseline alineadas al repo real.

### Non-goals
- No separar físicamente tests ni mover evals a otra carpeta.
- No tocar lógica de `CoachAgent`/`CoachPipeline`/post-match/knowledge (solo wiring del guard + texto de docs).
- No cambiar contratos de runtime ni el snapshot persistido.
- No refactors de código de app.
- No arreglar/rehabilitar `coach-eval.yml` ni el flujo de evals live (fuera de scope; queda como está).

---

## 3. Diseño por workstream (orden de commits)

Seis workstreams independientes, un branch, un PR. **El orden importa** (junk antes de renormalize).

### 3.1 `git rm` de junk trackeado (delta 1 — va primero)
Borrar los **20 archivos trackeados** con `git rm` (todos están trackeados; no hay junk untracked):

```
Tactical Lab 3D.zip
test-retrieval-tmp.ts
tmp-dev-server.err.log
tmp-dev-server.out.log
tmp-reality-cdp-advanced-results.json
tmp-reality-cdp-results.json
tmp-reality-dev.err.log
tmp-reality-dev.job.log
tmp-reality-dev.out.log
tmp-reality-screens/biblioteca.png
tmp-reality-screens/briefing.png
tmp-reality-screens/cancha-3d.png
tmp-reality-screens/diagnostico.png
tmp-reality-screens/evolucion.png
tmp-reality-screens/initial.png
tmp-reality-screens/post-partido.png
tmp-reality-screens/sala.png
tmp-reality-screens/sesion.png
tmp-reality-screens/video.png
tmp-weekly-trust-closure-results.json
```

Confirmar que `.env.local` sigue gitignored (`git check-ignore .env.local` → hit). Opcional: agregar patrones `tmp-*` / `*.zip` a `.gitignore` para prevenir recaída (sin salir de scope de higiene).

Commit dedicado: `chore(slice-0): git rm tracked junk (20 files)`.

### 3.2 `.gitattributes` eol=lf **+ biome `lineEnding: lf`** + renormalize (deltas 2 y 3 — renormalize DESPUÉS de borrar junk)

**Las dos mitades del mismo fix contra el churn de CRLF van juntas, co-locadas en este workstream:**

- `.gitattributes` con `* text=auto eol=lf` (repo → LF).
- `biome.json` con `"formatter": { "lineEnding": "lf" }` (formatter → LF).

Si solo se hace una mitad, la otra reintroduce el churn: `.gitattributes eol=lf` fuerza LF en el repo, pero un biome con `lineEnding: crlf` (o default) reescribiría a CRLF en cada `format` y volverían a pelearse. Con `core.autocrlf=true` en la máquina del usuario, `.gitattributes` toma precedencia para los archivos trackeados; biome LF asegura que el formatter no contradiga. **Ambos cambios se hacen y commitean como una unidad coherente en esta slice.**

> Nota de continuidad: Slice 0 solo hace cherry-pick de `41a074a` (Gemini), **no** de `abca0b6` (el commit de biome autofix en `wip/preserve-2026-07-01`). Por lo tanto `biome.json` en la rama de Slice 0 sigue siendo el de `main` (sin `lineEnding`), y esta mitad —`lineEnding: lf`— se **aplica fresca acá**. El resto del autofix de `abca0b6` queda para promoverse en una slice posterior.

> Orden de ejecución (swap Task 2↔3): la limpieza de Gemini (§3.3) corre **antes** que el renormalize, así el cherry-pick aplica sobre un árbol no-renormalizado (sin conflicto de EOL) y el renormalize posterior normaliza también los archivos del cherry-pick.

Crear `.gitattributes`:

```gitattributes
* text=auto eol=lf

# Binarios explícitos (nunca normalizar EOL)
*.glb   binary
*.png   binary
*.jpg   binary
*.jpeg  binary
*.gif   binary
*.webp  binary
*.ico   binary
*.woff  binary
*.woff2 binary
*.ttf   binary
*.zip   binary
*.mp4   binary
*.mov   binary
*.pdf   binary
```

Luego `git add --renormalize .`. Esto produce **un** commit grande pero semánticamente vacío (solo EOL); es el fix correcto de una sola vez. Después de esto el working tree queda limpio y el churn de CRLF no puede recurrir.

Commit dedicado: `chore(slice-0): add .gitattributes eol=lf + biome lineEnding lf, renormalize`.

> Orden confirmado: **junk (3.1) → gitattributes+biome+renormalize (3.2)**, así el renormalize no toca archivos que igual se borran.

### 3.3 Gemini cleanup como una unidad (delta 4)
La remoción de Gemini y la poda del lockfile son **una sola unidad**, apoyada en el WIP ya preservado:

1. **Cherry-pick `41a074a`** desde `wip/preserve-2026-07-01` (`chore: remove Gemini endpoint/route/dep + IA/build infra cleanup`): borra `api/ai/gemini.ts`, la ruta en `vite.config.ts`, el dep `@google/generative-ai` de `package.json`, `geminiConfigured` en `api/agent-status.ts` y limpia la copia de error de OpenRouter en `api/_utils.ts`. Esto elimina Gemini a nivel *source*.
   - Si el cherry-pick trae conflicto por EOL (viene después del renormalize de §3.2), resolver a favor del contenido semántico del commit (LF).
2. **Después** correr `npm install` para que `package-lock.json` deje de referenciar `@google/generative-ai` (3 refs hoy). El cherry-pick saca el dep de `package.json` pero **no** actualiza el lockfile; este paso cierra esa mitad.
3. **Validar que el diff del lockfile queda acotado a Gemini:** si `npm install` mete churn no relacionado (bumps de otras deps, reordenamientos), revertir esa parte y dejar solo la remoción de `@google/generative-ai` y sus deps huérfanas. Verificación: `grep -c "generative-ai" package-lock.json` → 0.

Commit dedicado (o el propio del cherry-pick + uno de lockfile si se prefiere separar): `chore(slice-0): remove Gemini (cherry-pick 41a074a) + prune lockfile`.

> Nota: `41a074a` también ajustó los globs de los scripts `format`/`lint` en `package.json` (parte del mismo commit de infra); eso viaja con el cherry-pick y es bienvenido en Slice 0 (higiene de tooling).

### 3.4 Guard de red offline (TDD — la única pieza de ingeniería real)
Nuevo setup file `tests/setup/networkGuard.ts`, cableado con un bloque `test.setupFiles` agregado a `vite.config.ts` (hoy no existe config de test).

Comportamiento:
- Override de `globalThis.fetch` (el path que usan los SDK de OpenAI/OpenRouter/embeddings) para **lanzar error ante cualquier host no-local**.
- El error nombra el host y explica cómo optar por red: `ALLOW_NETWORK_TESTS=1`.
- **Permite** `localhost`, `127.0.0.1`, `::1` (para no romper futuros tests contra el dev server / api local).
- **Escape hatch:** si `process.env.ALLOW_NETWORK_TESTS === "1"`, el guard no se instala (deja pasar todo). CI normal **no** setea esta variable.
- Preservar la `fetch` original y restaurarla si hiciera falta; no romper `Request`/`Response`/`Headers`.

Regla de colisión (delta explícito del usuario): si el guard hace fallar algún test porque intentaba una llamada live, **no mover el test**: mockearlo o gatearlo con `ALLOW_NETWORK_TESTS=1` en ese archivo. (La evidencia dice que ninguno falla, pero la regla queda escrita.)

Commit: `test(slice-0): offline network guard for vitest (fetch, localhost-allowed, ALLOW_NETWORK_TESTS escape hatch)`.

### 3.5 CI principal
Nuevo `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run type-check
      - run: npm run build
      - run: npm test
```

**Sin `secrets`, sin `ALLOW_NETWORK_TESTS`.** Es la señal verde reproducible que falta hoy. No se toca `coach-eval.yml`.

Commit: `ci(slice-0): add main CI (type-check + build + test, no secrets)`.

### 3.6 Docs de baseline
Actualizar `CLAUDE.md` y `AGENTS.md` al estado real:
- Agregar módulos ausentes: `board`, `scout`, `sketch`, `home`.
- Corregir la afirmación de que video no tiene análisis: existe `/api/video/pattern-scan` + `src/video/videoPatternScan.ts` (tagging manual + endpoint de detección de patrones por visión).
- Reflejar que el único camino IA es OpenRouter (Gemini removido).
- No reescribir los docs enteros; ediciones dirigidas a las secciones desfasadas.

Commit: `docs(slice-0): align CLAUDE.md/AGENTS.md with real repo structure`.

---

## 4. Contrato del network guard (para el plan TDD)

Unidad testeable de forma aislada. Casos:

1. **Host externo → throw.** Con el guard instalado y `fetch` original stubbeado, una llamada que simula el path del **SDK de OpenAI/OpenRouter** (fetch con URL `https://openrouter.ai/...` / `https://api.openai.com/...`) debe lanzar un error cuyo mensaje incluye el host y menciona `ALLOW_NETWORK_TESTS`. **El test cubre el path real del SDK (fetch stubbeado como lo llama el SDK), no un fetch crudo arbitrario** (delta 5).
2. **Localhost → permitido.** `fetch("http://localhost:5173/...")`, `127.0.0.1`, `::1` → delega al fetch original (stub) sin lanzar.
3. **Escape hatch.** Con `ALLOW_NETWORK_TESTS=1`, incluso un host externo delega al fetch original sin lanzar (guard no instalado).
4. **Regresión de suite.** El suite completo corre verde offline por defecto (el guard no rompe ningún test existente).

El fetch original se stubbea en los tests del guard para no depender de red real ni siquiera para el caso "permitido".

---

## 5. Manejo de errores / degradación

- El guard lanza un `Error` claro: `[networkGuard] Blocked network call to <host>. Tests run offline by default. Set ALLOW_NETWORK_TESTS=1 to allow live network in this run.`
- No hay degradación silenciosa: cualquier intento de red no-local en `npm test` falla ruidoso en vez de colgar o pegar a un vendor.

---

## 6. Aceptación

- [ ] `npm test` corre **offline por defecto** y verde (sin secrets, sin `.env.local`).
- [ ] `npm run type-check` verde.
- [ ] `npm run build` verde.
- [ ] `.github/workflows/ci.yml` presente y cubre `npm ci` + type-check + build + test, **sin secrets ni `ALLOW_NETWORK_TESTS`**.
- [ ] `.gitattributes` presente con `* text=auto eol=lf` + reglas binarias explícitas, **y `biome.json` en `lineEnding: lf`** (las dos mitades del fix CRLF, co-locadas).
- [ ] `git status` limpio tras junk-removal + renormalize (sin churn masivo de CRLF pendiente).
- [ ] Gemini removido a nivel source vía cherry-pick de `41a074a`; `grep -c "generative-ai" package-lock.json` → 0; diff del lockfile acotado a la poda de Gemini.
- [ ] `CLAUDE.md`/`AGENTS.md` mencionan `board`/`scout`/`sketch`/`home` y corrigen la afirmación de video.
- [ ] El PR documenta explícitamente que **el hang no se reprodujo** y que el gap real era falta de CI completo + guardrail offline.
- [ ] Test del network guard verde (host externo→throw vía path SDK, localhost→ok, escape hatch→ok).

---

## 7. Riesgos y mitigaciones

- **Renormalize toca casi todo el árbol.** Riesgo de esconder cambios semánticos en el diff gigante. Mitigación: hacerlo en commit dedicado y **después** del `git rm` de junk; revisar que `git diff --stat` del commit de renormalize sea solo EOL (no contenido).
- **`npm install` mete churn no relacionado en el lockfile.** Mitigación: acotar el diff a Gemini (delta 4); revertir bumps ajenos.
- **Cherry-pick de `41a074a`** (con el swap Task 2↔3 corre **antes** del renormalize, sobre el árbol post-junk cuyo base es `e5001b2` = padre de `41a074a`): debería aplicar limpio. Si aparece conflicto, resolver a favor del contenido semántico y verificar con `git diff --ignore-all-space` que no se perdió lógica.
- **`.gitattributes` y biome pelean por EOL si solo se hace una mitad.** Mitigación: co-locar ambos en §3.2 (`.gitattributes eol=lf` + biome `lineEnding lf`) y commitear como unidad.
- **El guard rompe un test que sí llamaba live.** Mitigación: mockear/gatear ese test in situ (no mover). Evidencia actual: ninguno.
- **Orden de merge.** Slice 0 va primero sí o sí; el resto del roadmap depende de este CI + árbol limpio.
