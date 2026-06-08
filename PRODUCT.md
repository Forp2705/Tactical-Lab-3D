# Product

## Register

product

## Users

Cuerpos tecnicos de futbol que trabajan semana a semana sobre problemas tacticos concretos. Usan RomboIQ en un contexto de staff, revision y planificacion, con necesidad de decidir rapido sin perder trazabilidad.

## Product Purpose

RomboIQ es un sistema operativo tactico local para convertir observaciones, diagnosticos, sesiones, post-partido y evolucion en un hilo semanal controlado por el staff. El exito es que un entrenador entienda en pocos segundos que problema se esta trabajando, con que evidencia, que accion sigue y como se va a revisar.

## Brand Personality

Preciso, sobrio, tactico. Debe sentirse premium y operativo, mas cerca de una sala tecnica profesional que de un laboratorio interno de IA.

## Anti-references

No debe parecer una landing de SaaS, un dashboard tecnico de debug, una pizarra generica, una consola de IA ni una interfaz cargada de badges, gradientes o paneles anidados. La incertidumbre y la calidad de evidencia deben permanecer visibles.

## Design Principles

1. Primera decision, luego detalle.
2. Primera accion, luego trazabilidad.
3. El hilo semanal manda sobre las superficies aisladas.
4. La evidencia debil se muestra como util, pero nunca como definitiva.
5. La identidad futbolistica debe ser sutil, funcional y legible.

## Accessibility & Inclusion

Apuntar a WCAG AA en contraste y foco visible. Mantener lectura clara en sesiones de trabajo prolongadas, respetar preferencias de reduccion de movimiento y evitar depender solo del color para distinguir estado, evidencia o confianza.

## Quick Sketch — Spec for a future pass (not implemented in this pass)

### Why

Coaches frequently need to communicate a tactical idea fast — a quick arrow, a zone, a couple of player tokens on a flat pitch — without opening the full 3D viewer or building a keyframed scene. TacticalPad-style tools win on this kind of low-friction, "napkin sketch" communication. RomboIQ's strength is the weekly decision loop and the 3D viewer, not freehand drawing, so Quick Sketch should stay a small, separate, optional layer — not a rebuild of Scene3D.

### Scope (smallest viable version)

- Flat 2D pitch rendered with SVG or Canvas2D (no Three.js, no R3F). Reuse the existing pitch geometry/markings constants if they are exposed as plain data; otherwise redraw a minimal flat pitch.
- Draggable player tokens: a fixed small set (e.g., 11 vs. 11 or fewer), plain colored circles with a number/role label, positioned by drag (pointer events, no physics).
- Simple annotations: straight/curved arrows, lines, and rectangular/circular zones, drawn by click-drag with a small tool palette (select, arrow, line, zone, text).
- Text labels: short free-text annotations anchored to a point on the pitch.
- Save as sketch: persist the sketch (tokens, annotations, labels, pitch orientation) as a small local-first JSON object in IndexedDB via Dexie, alongside existing client persistence.
- Attach sketch to a session block: store a sketch reference (id) on a `Session` block so it shows as a thumbnail/preview in the session planner.
- Optional future "promote to 3D": a later, separate pass could read a saved sketch and seed a blank `Exercise`/`Scene` with actor start positions derived from token coordinates. Out of scope now — only the data shape should be designed to make this plausible later (e.g., normalized 0-100 coordinates compatible with `Actor`/pitch coordinate conventions in `src/viewer/lib/coords.ts`).

### Explicitly out of scope for this future pass

- No freehand/pressure-sensitive drawing engine, no undo-stack-heavy vector editor.
- No animation, keyframes, or playback — Quick Sketch is static.
- No automatic conversion of a sketch into a full 3D scene in the same pass (that is the optional "promote to 3D" follow-up).
- No new AI surface attached to sketches.
- No backend/cloud storage — local-first only, same persistence model as the rest of the app.

### Suggested module boundaries

New, isolated module, e.g. `src/sketch/`:

- `QuickSketchView.tsx` (or a panel/modal variant) — canvas/SVG surface, tool palette, token placement.
- `sketchSchemas.ts` — small Zod schema for `Sketch` (tokens, annotations, labels, pitch orientation, version) living next to `src/data/schemas.ts` conventions but as its own type, to avoid touching `ExerciseSchema`/`SceneSchema`.
- A small set of pure helpers for hit-testing, coordinate normalization, and serialization — kept framework-agnostic so they are testable without React or Three.js.

Persistence: extend `db.ts` following the existing migration pattern (new `snapshotShape` field, a `MIGRATIONS` step, defaults in `migrateSnapshot`, and the `saveSnapshot` call in `App.tsx`) — the same chain already used for `libraryFavoriteIds`/`libraryRecentOpens`.

Session attachment: add an optional `sketchId` (or similar) reference on session blocks in `schemas.ts`/`useAppStore.ts`, surfaced as a thumbnail in `SessionsView.tsx`. This is the only point where Quick Sketch should touch existing session data — as an optional pointer, not a structural change.

### Files/modules it should touch

- New `src/sketch/` module (view, schema, helpers).
- `src/state/db.ts` and `src/state/useAppStore.ts` for persistence wiring (additive fields only).
- `src/sessions/SessionsView.tsx` for an optional sketch-thumbnail-on-block affordance.
- `src/app/theme.css` for a small set of new classes scoped to the sketch surface.

### Files/modules it should NOT touch

- `src/viewer/Scene3D.tsx`, `Pitch3D.tsx`, `Player3D.tsx`, `Ball3D.tsx`, `Overlays.tsx`, and `src/viewer/lib/*` (coords, runtime, matchEngine) — Quick Sketch is a flat, static, separate surface and must not share rendering or playback code with the keyframed 3D viewer.
- `src/data/schemas.ts` core `Exercise`/`Scene`/`Actor` types — define a separate `Sketch` schema instead of extending these.
- `src/ai/*` — no AI surface for sketches in this or the next pass.
- `src/team/LineupLab3D.tsx` — shapes/lineups stay on their current path; do not merge sketch tokens with lineup/shape data models.

### Effort estimate (rough, for planning only)

- Schema + persistence wiring: 0.5–1 day (small, follows an established pattern).
- Flat pitch + draggable tokens (SVG/Canvas2D, pointer events): 1.5–2.5 days.
- Annotation tools (arrow/line/zone/text) with a minimal palette and basic hit-testing: 2–3 days.
- Save/attach-to-session-block UI and thumbnail rendering: 1 day.
- Tests (schema validation, coordinate normalization, serialization round-trip): 0.5–1 day.
- Total: roughly 5.5–8.5 days for a minimal but solid version, excluding the optional "promote to 3D" follow-up.

### Risks

- Scope creep toward a full vector editor (undo/redo, multi-select, layering) — must be resisted; keep the tool palette minimal.
- Coordinate-system mismatch between the flat sketch space and the 3D pitch/`coords.ts` conventions could make a future "promote to 3D" harder if not designed with normalized coordinates from the start.
- Persistence growth: another `snapshotShape` field means another migration to maintain — keep the `Sketch` payload small and versioned.
- UI clutter risk: Quick Sketch must stay a clearly secondary, opt-in surface (e.g., reached from a session block or library action) so it does not compete with the 3D viewer or make advanced modules more prominent, per the product's "primera decision, luego detalle" principle.
- Mobile/touch input for drag-and-drop annotation needs care (pointer events vs. touch events) even though native mobile is out of scope — the web app may still be opened on tablets pitch-side.
