# AGENTS.md — Tactical Lab 3D

## 1. Qué es este proyecto

Tactical Lab 3D es una app local/web para cuerpos técnicos de fútbol. El producto mezcla:

- biblioteca de ejercicios tácticos;
- visor 3D para escenas coreografiadas;
- gestión de plantel y shapes tácticas;
- planificación de sesión y microciclo;
- tagging y tracking manual de video;
- un asistente táctico IA;
- un flujo de análisis post-partido con memoria táctica controlada.

No es una app social, no tiene backend tradicional persistente multiusuario y no está pensada como SaaS todavía. La persistencia principal del lado cliente vive en IndexedDB. La IA corre a través de endpoints server-side / serverless para no exponer keys.

La dirección de producto es herramienta premium de staff, no pizarra genérica.

---

## 2. Stack técnico

- Frontend: React 18 + TypeScript + Vite
- 3D: Three.js vía React Three Fiber + drei + postprocessing
- Estado cliente: Zustand
- Persistencia cliente: Dexie / IndexedDB
- Validación: Zod
- Export PDF: `@react-pdf/renderer`
- Drag and drop: `@dnd-kit`
- Video/media export: `@ffmpeg/ffmpeg`
- IA server-side:
  - OpenRouter vía `openai` SDK
  - endpoint legacy Gemini todavía presente en `api/ai/gemini.ts`
- Testing: Vitest
- Lint/format: Biome

---

## 3. Cómo correrlo

### Desarrollo

```bash
npm install
npm run dev
```

La app levanta por defecto en:

```text
http://localhost:5173
```

### Build

```bash
npm run build
```

### Type-check

```bash
npm run type-check
```

### Tests

```bash
npm test
```

### Scripts útiles de IA / memoria / knowledge

```bash
npm run coach:test
npm run memory:test
npm run knowledge:test
npm run memory:build
npm run memory:consolidate
```

---

## 4. Variables de entorno

Archivo esperado:

```text
.env.local
```

Variables relevantes:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

Opcionalmente pueden existir variables para Gemini si se usa el endpoint legado.

Regla importante:

- Nunca importar módulos server-only del agente directamente desde componentes React.
- El frontend debe usar endpoints en `/api/...`.

---

## 5. Estructura de carpetas

## Raíz

- `api/`
  - boundary server-side para IA y post-match
- `public/`
  - assets estáticos, incluidos modelos `.glb`
- `scripts/`
  - tooling puntual, por ejemplo generación del footballer
- `src/`
  - código principal de la app
- `tests/`
  - tests de coords, match engine, microcycle y post-match

## `src/app`

- `App.tsx`
  - composición principal de vistas
  - wiring de toolbar, viewer y vistas principales
- `theme.css`
  - tema global

## `src/data`

- `schemas.ts`
  - contrato central del dominio con Zod
- `players.ts`
  - plantel demo
- `index.ts`
  - export del catálogo y helpers
- `exercises/`
  - catálogo curado de ejercicios

## `src/state`

- `useAppStore.ts`
  - store central de Zustand
  - estado de vistas, viewer, tags, tracks, sesión, microciclo, team, IA prompt y `coachShapeContext`
- `db.ts`
  - persistencia local con Dexie
  - `loadSnapshot`, `saveSnapshot`, migración mínima y validación Zod

## `src/viewer`

- `Scene3D.tsx`
  - canvas 3D principal del visor
  - cámaras, luces, postprocesado, loop de playback
- `Pitch3D.tsx`
  - cancha 3D
- `Player3D.tsx`
  - jugadores
- `Ball3D.tsx`
  - pelota
- `Overlays.tsx`
  - líneas, zonas y overlays tácticos
- `lib/`
  - coords
  - runtime
  - match engine

## `src/team`

- `TeamView.tsx`
  - vista del plantel y edición general
- `LineupLab3D.tsx`
  - laboratorio 3D de shapes, transitions, rival overlay y snapshot contextual para el coach

## `src/library`

- `LibraryView.tsx`
  - catálogo de ejercicios

## `src/sessions`

- `SessionsView.tsx`
  - planner con drag-and-drop
  - export PDF de sesión
- `MicrocycleAlerts.ts`
  - reglas y alertas del microciclo

## `src/video`

- `VideoView.tsx`
  - carga de video, tagging simple y tracking manual por click

## `src/export`

- `PlayerView.tsx`
  - vista simplificada
- `media.ts`
  - export de media

## `src/ui`

- `AppShell.tsx`
  - shell principal, navegación lateral y layout macro

## `src/ai`

Este módulo hoy tiene dos capas:

### A. Asistente táctico conversacional

- `CoachAgent.ts`
  - núcleo server-side del coach
  - usa OpenRouter
  - compone prompt con contexto del equipo, memoria, reports recientes, plantel disponible y shape actual
- `CoachAgentPrompt.ts`
  - system prompt
- `CoachSchemas.ts`
  - schema de salida del coach
- `coachAgentClient.ts`
  - cliente frontend contra `/api/coach-agent`
- `AiView.tsx`
  - UI de consulta táctica

### B. Infraestructura táctica / retrieval

- `tacticalKeywords.ts`
  - diccionario de matching semántico para observations/knowledge
- `retrieveRelevantContext.ts`
  - retrieval de observaciones
- `retrieveRelevantKnowledge.ts`
  - retrieval de base de conocimiento
- `retrieveRelevantGeneratedMemory.ts`
  - retrieval de memoria consolidada
- `MatchMemory.ts`
  - principios estables
- `MatchObservations.ts`
  - observaciones base / fallback
- `generated/`
  - memoria táctica generada
- `knowledge/`
  - base de conocimiento ya procesada
- `sources/`
  - fuentes base de conocimiento

### C. Post Match Analysis

- `post-match/generatePostMatchReport.ts`
  - generación del informe post-partido
- `post-match/PostMatchAnalysisView.tsx`
  - UI de input, revisión, guardado, historial y commit de memoria
- `post-match/PostMatchPdf.tsx`
  - render del PDF del reporte
- `post-match/postMatchClient.ts`
  - cliente frontend para `/api/post-match/...`
- `post-match/storage.ts`
  - guardado/lectura de reports server-side
- `post-match/schemas.ts`
  - schemas del flujo post-partido
- `post-match/reportPresentation.ts`
  - normalización / humanización de texto para la UI

---

## 6. Mapa funcional de la app

## Biblioteca

La biblioteca consume el catálogo curado desde `src/data`. El usuario selecciona ejercicios y puede abrirlos en el visor o agregarlos a sesión.

## Visor 3D

El visor toma un `Exercise` y reproduce `scene` en tiempo real:

- actores con keyframes;
- pelota con keyframes;
- overlays y zonas por fases;
- capas tácticas (`withBall`, `withoutBall`, `press`, etc.);
- cámaras `top`, `iso`, `broadcast`.

El playback corre desde `Scene3D.tsx` con `useFrame`, leyendo estado del store.

## Team / Lineup Lab

El módulo de equipo administra:

- plantel;
- edición básica del jugador;
- lineups;
- shapes tácticas;
- transición entre shapes;
- presencia del rival.

Punto importante:

`LineupLab3D.tsx` publica un `coachShapeContext` al store. Ese snapshot luego se inyecta al asistente IA para darle lectura contextual del shape actual.

## Sessions / Microcycle

La sesión es una colección de bloques con ejercicios.

El store recalcula:

- duración total;
- carga total;
- materiales;
- objetivos primarios.

El microciclo es un objeto semanal con días `MD+1`, `MD+2`, `MD-4`, `MD-3`, `MD-2`, `MD-1`, `MD`. Las alertas salen de `computeMicrocycleAlerts`.

## Video

El módulo de video hoy es deliberadamente limitado:

- carga archivo local;
- permite tags por botón con timestamp;
- permite tracking manual haciendo click en el canvas;
- exporta CSV de tracks.

No hay análisis automático de video en esta etapa.

## Asistente táctico IA

El flujo correcto es:

`AiView.tsx` -> `coachAgentClient.ts` -> `/api/coach-agent` -> `CoachAgent.ts`

`CoachAgent.ts` compone un prompt con:

- system prompt;
- contexto técnico consolidado;
- memoria estable;
- memoria táctica generada relevante;
- observaciones relevantes;
- knowledge relevante;
- contexto temporal;
- últimos reports post-match;
- plantel disponible/no disponible;
- shape context actual.

El agente devuelve JSON validado por `CoachMatchAdviceSchema`.

## Post Match Analysis

El flujo correcto es:

1. staff carga contexto del partido;
2. agrega plan previo, notas y tags;
3. `/api/post-match/generate` genera el reporte;
4. staff revisa;
5. guarda reporte;
6. opcionalmente selecciona memory candidates;
7. recién ahí se escribe memoria táctica.

Regla central:

- La memoria no se actualiza automáticamente.

---

## 7. Endpoints server-side

## `api/coach-agent.ts`

- Método: `POST`
- Input:
  - `input`
  - `coachContext` opcional
- Ejecuta `generateCoachResponse`
- Devuelve el JSON validado del coach

## `api/post-match/generate.ts`

- Método: `POST`
- Ejecuta `generatePostMatchReport`
- Valida input con Zod

## `api/post-match/reports.ts`

- `GET`
  - lista historial
- `POST`
  - guarda reporte

## `api/post-match/memory.ts`

- commit explícito de `memoryCandidates` seleccionados por staff

## `api/agent-status.ts`

- chequeo de disponibilidad / estado del agente

## `api/ai/gemini.ts`

- endpoint legado / alternativo
- no es el camino principal actual si el coach está montado sobre OpenRouter

---

## 8. Dominio de datos importante

El contrato del dominio vive principalmente en [src/data/schemas.ts](C:\Users\Facundo\Documents\football-tactics-pro\tactical-lab-3d\src\data\schemas.ts).

Tipos clave:

- `Player`
- `Exercise`
- `Scene`
- `Actor`
- `Ball`
- `Overlay`
- `Zone`
- `Trigger`
- `Session`
- `Microcycle`
- `Lineup`

Regla importante:

- Si un cambio rompe `schemas.ts`, probablemente arrastra viewer, session planner, export, tests y persistencia.

---

## 9. Persistencia

## Cliente

Persistencia cliente en IndexedDB vía Dexie:

- DB name: `tactical-lab-3d`
- snapshot principal: `latest`

Se persiste:

- vista actual;
- cámara;
- ejercicio seleccionado;
- filtros;
- variantes locales;
- layers;
- team;
- session;
- microcycle;
- tags;
- tracks;
- ai prompt.

No todo vive en server.

## Server-side local / serverless

El módulo post-match y parte de la memoria usan archivos locales / rutas del lado servidor. No deben ser importados desde componentes cliente.

---

## 10. Tests existentes

En `tests/` ya existen al menos:

- `coords.test.ts`
- `matchEngine.test.ts`
- `microcycleAlerts.test.ts`
- `postMatchResult.test.ts`
- `postMatchSchema.test.ts`

Si se toca:

- coords;
- match engine;
- grounding post-match;
- alertas del microciclo;

hay que correr esos tests.

---

## 11. Comandos recomendados para validar cambios

## Siempre

```bash
npm run type-check
npm run build
```

## Si tocás IA / post-match

```bash
npm test -- --run tests/postMatchResult.test.ts tests/postMatchSchema.test.ts
```

## Si tocás viewer / runtime

```bash
npm test -- --run tests/coords.test.ts tests/matchEngine.test.ts
```

## Si tocás microciclo / sesión

```bash
npm test -- --run tests/microcycleAlerts.test.ts
```

---

## 12. Convenciones y límites operativos

## Lo que sí conviene hacer

- Preferir cambios acotados y dirigidos.
- Mantener el boundary server/client claro.
- Validar output IA con Zod antes de usarlo.
- Reusar `schemas.ts` y helpers existentes en vez de inventar modelos paralelos.
- Mantener el flujo post-match controlado por staff.

## Lo que no conviene hacer

- No importar `CoachAgent.ts` en React.
- No exponer API keys al cliente.
- No escribir memoria táctica automáticamente al guardar un reporte.
- No romper el store persistido sin migración mínima.
- No meter lógica nueva pesada en `App.tsx`; derivarla a módulos.

---

## 13. Zonas sensibles del repo

## A. Prompt / agente

Archivos sensibles:

- `src/ai/CoachAgent.ts`
- `src/ai/CoachAgentPrompt.ts`
- `src/ai/CoachRules.ts`
- `src/ai/TeamContext.ts`
- `src/ai/teamIdentity.ts`
- `src/ai/FootballIdentity.ts`

Cambios ahí impactan directamente la calidad de salida del coach.

## B. Post-match

Archivos sensibles:

- `src/ai/post-match/generatePostMatchReport.ts`
- `src/ai/post-match/schemas.ts`
- `src/ai/post-match/storage.ts`
- `src/ai/post-match/reportPresentation.ts`

Errores ahí suelen aparecer como:

- Zod failures;
- grounding incorrecto;
- PDF incompleto;
- historial roto;
- memory candidates mal normalizados.

## C. Viewer / runtime

Archivos sensibles:

- `src/viewer/Scene3D.tsx`
- `src/viewer/lib/coords.ts`
- `src/viewer/lib/runtime.ts`
- `src/viewer/lib/matchEngine.ts`
- `src/viewer/Pitch3D.tsx`
- `src/viewer/Player3D.tsx`

Errores típicos:

- cámara top mal encuadrada;
- sincronía mala entre actores y pelota;
- overlays fuera de fase;
- viewers pesados o con chunk demasiado grande.

## D. Store / persistencia

Archivos sensibles:

- `src/state/useAppStore.ts`
- `src/state/db.ts`

Si cambia la forma del snapshot, hay que pensar migración o fallback razonable.

---

## 14. Estado actual resumido

Hoy el repo ya tiene:

- app React funcional;
- visor 3D operativo;
- lab táctico de shapes;
- planner de sesión;
- tagging/tracking manual;
- asistente táctico server-side;
- análisis post-match con historial, PDF y memoria controlada.

Todavía hay deuda:

- bundle grande en build;
- warnings de import dinámico/estático de store/db;
- endpoint Gemini legacy coexistiendo con OpenRouter;
- varias capas IA que conviene no mezclar por error;
- el módulo video todavía no alimenta análisis automático real.

---

## 15. Regla práctica para futuros cambios

Si un pedido toca IA, primero distinguir cuál de estos tres sistemas afecta:

1. `CoachAgent` conversacional;
2. `Post Match Analysis`;
3. tooling de knowledge/memory/retrieval.

No asumir que un cambio en uno debe replicarse en los otros.

Si un pedido toca viewer, distinguir:

1. viewer de ejercicios;
2. LineupLab3D;
3. PlayerView/export.

Comparten assets y parte de coords, pero no son el mismo flujo.

---

## 16. Resumen ejecutivo para alguien que entra nuevo

Si entrás a este repo por primera vez:

1. Mirá `src/app/App.tsx` para entender qué vistas existen.
2. Mirá `src/state/useAppStore.ts` para entender el estado real de la app.
3. Mirá `src/data/schemas.ts` para entender el dominio.
4. Mirá `src/viewer/Scene3D.tsx` si vas a tocar el visor.
5. Mirá `src/team/LineupLab3D.tsx` si vas a tocar shapes o context injection.
6. Mirá `src/ai/CoachAgent.ts` si vas a tocar el coach.
7. Mirá `src/ai/post-match/` si vas a tocar análisis post-partido.

Ese es el orden correcto para no romper cosas por trabajar a ciegas.
