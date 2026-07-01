# SHIP_PLAN.md — Plan de ship (beta cerrada multi-staff en Vercel)

Fecha: 2026-07-01. Reemplaza la versión anterior de este plan, que asumía producto ship-ready y solo atacaba infraestructura. Este plan parte de la premisa contraria: **no sabemos si el producto está al nivel**, y la primera fase existe para responder eso con evidencia, no con opinión.

## Contexto que ya existe en el repo

- `ROMBOIQ_PRODUCT_BENCHMARK_2026-06.md` (2026-06-07): benchmark competitivo serio. Veredicto: el loop semanal + IA con TrustGuard es diferenciador real (7–7.5/10), pero board fluency, export y pulido estaban atrás (4–5.5/10). Pilot readiness: 5/10. Define en §13 el scope de MVP para piloto y en §10 un **gate de validación** concreto.
- `FLUENCY_PASS_REPORT.md` y `CLOSEOUT_REPORT_onboarding_pitchside_quicksketch.md`: pases posteriores que cerraron varios de los top-10 gaps del benchmark: export PNG one-tap, "crear ejercicio desde cero", favoritos/recientes, AiView decision-first, Quick Sketch implementado (no solo spec), onboarding de coach real, modo cancha. Suite en verde (209 tests al cierre; hoy 81 archivos de test).
- **El hueco explícito y repetido en ambos reportes:** nada de esto se validó en navegador real con la app corriendo. Toda la validación fue por contrato de código + tests. Si algo visual/UX está roto, no se detectó.

Conclusión honesta: el producto probablemente está mejor de lo que sentís (varios gaps ya se cerraron), pero la sensación de "no está" es legítima porque **nunca se ejecutó el gate de validación** que tu propio benchmark definió.

---

## Fase 0 — Gate de producto: ¿está o no está? (1–2 días)

Esto va antes que cualquier trabajo de infra. Correr `npm run dev` y ejecutar a mano:

**0.1 El gate del benchmark (§10):** una persona que no conoce la app debe poder, sin que le expliquen nada: (1) bocetar una idea táctica en <30 segundos (Quick Sketch), (2) armar una sesión a partir de eso en <5 minutos, (3) exportar algo compartible en un tap. Si podés, hacelo con alguien de tu staff; si no, hacelo vos cronometrando y anotando cada duda.

**0.2 Los 5 checklists manuales del closeout report** (Quick Sketch 14 pasos, Onboarding 7, Coach identity 5, Modo cancha 11, Regresión 5) — están trazados en `CLOSEOUT_REPORT_onboarding_pitchside_quicksketch.md` §10; ejecutarlos en vivo por primera vez.

**0.3 Recorrido de staff nuevo:** workspace real vacío → onboarding → primera consulta al coach → primer post-match. Anotar cada momento de fricción o pantalla que "no está".

**Salida de la Fase 0: una punch-list priorizada** con cada ítem clasificado en tres baldes:
- **Bloquea beta** — un coach abandonaría la app por esto.
- **Se recorta** — se saca del alcance de la beta (feature flag, ocultar entrada, o enmarcar como "manual por diseño" como ya hace CLAUDE.md con video).
- **Post-beta** — mejora real pero no bloquea.

Regla anti-parálisis (del benchmark §13): la beta debe ser **más angosta pero más terminada** — mejor recortar LineupLab avanzado o video de la primera impresión que pulir todo a medias.

## Fase 1 — Cerrar la punch-list "bloquea beta"

No se puede detallar hasta tener la salida de Fase 0, pero los candidatos probables según el benchmark (gaps aún no cerrados por los pases posteriores):

- Densidad de `PostMatchAnalysisView` (el pase decision-first solo tocó AiView).
- Fricción del visor 3D para uso diario (cámaras, layers, settings — "engineer's tool").
- Export share-grade más allá del PNG (link compartible quedó fuera a propósito; decidir si entra).
- Cualquier rotura visual que aparezca en 0.2 (nunca hubo pasada visual).

Criterio de done de la fase: el gate 0.1 pasa limpio con una persona que no sos vos.

## Fase 2 — Infraestructura para beta multi-staff (blockers técnicos verificados)

Esto ya está auditado contra el código y es trabajo cierto, se haga cuando se haga. Solo arranca cuando Fase 1 cierra — no tiene sentido poner auth y storage a un producto que todavía cambia.

**2.1 Storage server-side persistente.** `src/ai/serverDataPaths.ts:12-14` escribe a `/tmp/tactical-lab-3d` en Vercel → reports post-match y memoria táctica se pierden en cada redeploy. Migrar a Vercel Blob o Postgres detrás de una interfaz `get/put`, manteniendo filesystem como driver dev (`TACTICAL_LAB_DATA_DIR` ya existe). Afecta `storage.ts`, `loadGeneratedMemory.ts`, `coachObservability.ts`, `embeddingRetrieval.ts`, `api/post-match/*`. La tarea más grande del plan.

**2.2 Auth de beta cerrada.** Cero auth hoy: `/api/coach-agent`, `/api/post-match/*`, `/api/video/pattern-scan` abiertos a internet → cualquiera quema tu crédito OpenRouter. Mínimo viable: `BETA_STAFF_TOKENS` (JSON token→staffId) en env, helper `requireStaff` en `api/_utils.ts`, pantalla de código de acceso guardado en Dexie.

**2.3 Aislamiento por staff.** `staffId` como namespace en todas las keys del storage de 2.1. Cliente ya aislado gratis (IndexedDB por navegador); el problema es solo server-side, donde hoy todo cae al `team-real-default` implícito.

**2.4 Rate limiting inbound.** Hoy solo se traduce el 429 de OpenRouter (`api/_utils.ts:60-68`); nada limita requests entrantes. Contador por staffId + ventana en los tres endpoints IA. Límite generoso (~50/hora): frena loops y abuso, no molesta al staff.

## Fase 3 — Pre-ship

- Suite completa verde (`npm test`, los 81 archivos) + type-check + build tras las migraciones de Fase 2.
- Validar pattern-scan de video end-to-end contra el deploy (ya está cableado en `VideoView.tsx` pese a lo que dice CLAUDE.md — nunca se probó con video real en prod, y tiene costo de modelo visual por frame).
- Export/import de snapshot local (JSON): un beta user que limpia el navegador hoy pierde todo su workspace. Mínimo un botón de backup + aviso en onboarding.
- Env vars en Vercel (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `BETA_STAFF_TOKENS`, storage) y actualizar `.env.example`.
- Smoke test en prod: token → coach → report post-match → redeploy → el report sigue ahí.
- Alerta de presupuesto en OpenRouter antes de repartir tokens.
- Actualizar CLAUDE.md (pattern-scan, storage, auth) — el mapa hoy no coincide con el territorio.

## Métrica de éxito de la beta

Del benchmark §13, vale la pena adoptarla tal cual: un coach abre RomboIQ voluntariamente un día que no hay partido, sin que se lo pidas. Eso — no la cantidad de features — es la señal de que el loop funciona.

## Cómo ensambla con el roadmap de slices (docs/superpowers/roadmap-2026-07-ship-ready.md)

Este plan y el roadmap de slices no compiten: el roadmap es el **mecanismo de ejecución** (un slice = un branch/PR con flujo superpowers) y este plan es el **marco macro** que decide qué slices existen y en qué orden. Reconciliación concreta:

- **Slice 0 se termina primero, tal cual está** (va por Task 4; es higiene + CI, no depende de nada de este plan).
- **La Fase 0 de este plan se inserta como slice nueva después de Slice 0** ("Slice 0.5 — Gate de producto en vivo"). Es la pieza que al roadmap le falta, y además **re-scopea las slices A–E**, porque los "hechos verificados" del roadmap quedaron viejos respecto de este branch (verificado 2026-07-01):
  - **Slice A (PNG):** el PNG del *viewer* ya existe (`exportCanvasImage` en `src/export/media.ts`); lo que falta es solo el PNG del *board* (`exportBoard.ts` no rasteriza). Slice válida pero mitad de tamaño.
  - **Slice D (video):** el cableado UI → `/api/video/pattern-scan` **ya está hecho** (`runPatternScan` en `VideoView.tsx:415`). Queda solo el flag beta, la guarda de costo y probarlo con video real. ~80% cerrada.
  - **Slice C:** `OPENROUTER_FALLBACK_MODELS` ya se lee en `CoachAgent.ts:312`; queda verificar que entra en runtime + los tests de degradación.
  - **Slice E** solapa con los pases fluency/closeout ya mergeados (AiView decision-first ya hecho); la punch-list del gate dirá si queda algo real (candidato principal: `PostMatchAnalysisView`).
- **Las Fases 2 y 3 de este plan se agregan como slices nuevas al final** (F: storage persistente; G: auth + aislamiento + rate limit; H: pre-ship). El roadmap las excluye a propósito ("sin features grandes"), pero la beta multi-staff en Vercel no existe sin ellas.

Actualizar los "hechos verificados" del roadmap antes de delegar cualquier slice — hoy harían que un spec re-derive trabajo ya hecho.

## Secuencia

Slice 0 (cerrar) → Fase 0 / gate en vivo (1–2 días) → re-scope y ejecución de A–E según punch-list → Fase 2 como slices F–G (storage es lo grande) → Fase 3 / pre-ship.

Regla del repo para todo el plan: `npm run type-check && npm run build` en cada cambio, más los tests del área tocada según CLAUDE.md §11.
