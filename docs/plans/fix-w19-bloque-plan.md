# fix/w19-bloque — plan (REGION BLOQUE, mc-22)

Base: `fix/w19-bloque` stacked sobre mc-18 `976518a`. Spec: `W19-BLOCK-AUDIT.md` (mi
propia auditoria) + `W19-BRIEF-BLOQUE-FIXES.md`. Scope: SOLO `SessionBlockCard` y
sus subcomponentes en `src/sessions/SessionsView.tsx` (fila + details de fila) +
CSS scoped. No tocar `SessionsView()` top-level (REGION FLUJO de mc-19),
DndContext/sensors, store/schema, catalogo de datos, visor (Scene3D/lib), export.

## H1 (P0) — boton "Ver en cancha 3D" en la fila del bloque

Ya hay un marcador `W19 REGION BLOQUE (mc-22)` en
`SessionsView.tsx:598-600` dentro de `.session-block-attach-flags`, antes del
boton "Quitar" (linea 602-608).

- Patron confirmado (igual a `LibraryView.tsx:492-497`):
  `useAppStore.getState().selectExercise(exercise.id)` seguido de
  `useAppStore.getState().setView("viewer")`.
- `selectExercise` (`useAppStore.ts:878-884`) ya limpia
  `viewerExerciseOverride: null` y fija `selectedExerciseId` — el visor
  (`App.tsx:294-298`, `resolveViewerSelection`) resuelve el ejercicio del bloque
  sea curado (`catalog`) o variante (`exerciseVariants`) sin trabajo extra: NO
  hace falta guard especial para variantes.
- Guard "retirado": automatico por estructura — el boton se agrega solo en el
  return principal de `SessionBlockCard` (linea 565+), que solo se alcanza si
  `exercise` resolvio (linea 485-536 es el early-return del tombstone, sin
  boton). No se necesita chequeo adicional.
- Implementacion: `<button type="button" className="secondary sm"
  onClick={...}>Ver en cancha 3D</button>` dentro de
  `.session-block-attach-flags`, antes de "Quitar". CSS: reusar `.secondary.sm`
  existente (ya usado en la fila), sin clase nueva salvo que el flexbox de
  `.session-block-attach-flags` necesite ajuste de `min-width`/`gap` para el
  boton nuevo (hoy pensado para 2 iconos ✎/▦ de ancho fijo 28px).

## H2 — chips del catalogo (dorado vs desaturado)

Verificado en `theme.css:8544-8569`: mc-18 ya aplico el mismo patron de
especificidad que Library (`.session-drawer-filters .smart-filter-chip`,
comentario propio citando el fix de Library). Confirmado en vivo con captura
pendiente. **Ya resuelto — no se toca.**

## H3 (mio, del audit) — input de duracion sin label/unidad

`session-block-duration` (`SessionsView.tsx:582-594`) sigue siendo un
`<input type="number">` sin `aria-label` ni sufijo "min". Fix quirurgico:
agregar `aria-label="Duracion del bloque en minutos"` al input y un sufijo
visual "min" (span mono junto al input, mismo patron que el RPE de al lado).
Cero cambio de layout mayor, dentro de mi region.

## Validacion

1. `npm run type-check`
2. `npm run build`
3. `npm test -- --run` (suite completa; en particular
   `tests/microcycleAlerts.test.ts` si algo de alerts se toca — no deberia)
4. Vivo (`npm run dev`): bloque curado -> "Ver en cancha 3D" -> visor muestra
   ESE ejercicio (no `catalog[0]`) -> volver a Sesion via nav -> bloques
   intactos. Repetir con un bloque de `exerciseVariants` ("Mis ejercicios" /
   bloque creado desde Pizarra). Confirmar que un bloque retirado NO muestra el
   boton. Confirmar que el drag de la fila (activationConstraint distance 8)
   sigue funcionando con el boton nuevo al lado.
5. Capturas antes/despues del boton en la fila.
6. Sin push. `done` una linea con SHA al coordinador.
