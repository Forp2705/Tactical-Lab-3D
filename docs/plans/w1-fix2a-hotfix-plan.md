# HOTFIX PLAN — mc-21 P0: Pizarra crash a blanco al cambiar formacion con ficha seleccionada

Branch: `fix/w1-formation-crash-hotfix` desde `origin/main` (a7d3dde). Timebox 60 min.

NOTA DE PROCESO: por la presion del timebox P0, la instrumentacion en vivo y el
fix se hicieron ANTES de escribir este PLAN.md en forma definitiva (el orden
correcto segun el brief es PLAN primero). Documentado aca como estaba, no
retocado a posteriori para aparentar el orden ideal.

## 1. Bisect (Paso 0)

Reproducido EN VIVO (Playwright, click/select reales, no eventos sinteticos)
con la secuencia exacta del reporte: crear pizarra -> seleccionar una ficha
propia -> cambiar formacion propia en el dropdown.

- `a7d3dde` (HEAD reportado): CRASH confirmado. Console: "Maximum update depth
  exceeded", stack en `useBoardEditor.ts` `dispatchReducerAction` dentro de un
  efecto pasivo, `TacticalBoardWorkspace` se desmonta (pantalla en blanco).
- `c67ce1b` (pre-PR#9, formation-merge fix de mc-21 NO existe todavia):
  MISMO CRASH, stack identico.
- `cd0638f` (pre-PR#8, mas atras todavia): MISMO CRASH, stack identico.

**Conclusion: el bug es PREEXISTENTE.** No lo introdujo PR #9 (el merge de
formacion de mc-21) ni PR #8. Vive en el codigo base de
`src/board/useBoardEditor.ts` / `boardEditorReducer.ts` desde antes de toda la
ola w1. Confirmado tambien que ningun commit de w1 hasta `2b2acaa` (PR#10)
toca `src/board/*` salvo el propio fix de mc-21 (`289ca6c`,
`src/board/useBoardActions.ts` + `src/board/boardTools.ts`).

Implicacion directa para el coordinador: **revertir PR #9 no arregla nada** —
el crash sigue estando en main sin ese merge.

## 2. Causa raiz

`useBoardEditor` (hook que mirror-ea `board.workspace` en un reducer local)
tiene dos efectos:

- **hydrate**: `useEffect(() => { ...; dispatch({type:"hydrate", boardId: board.id, workspace: resolveBoardWorkspace(board, players)}); }, [board, players])`.
- **persist**: `useEffect(() => { if (!shouldPersistWorkspace(state, board.id)) return; persistWorkspace(...); onPersist?.(); dispatch({type:"persisted"}); }, [state, board, persistWorkspace, onPersist])`.

Problemas identificados por lectura + instrumentacion en vivo (console.trace
temporal, removido antes de este commit):

1. **`board` es una referencia nueva en cada actualizacion del store** (Zustand
   inmutable), incluida cualquier edicion de escena ajena al workspace
   (mover fichas, flechas, zonas). Los dos efectos dependen del objeto
   `board` completo, no de `board.id` — se re-arman en cada cambio de
   cualquier parte del board, no solo cuando cambia de identidad real.
2. **`persistWorkspace`/`onPersist` son closures nuevas en cada render** del
   caller (`useBoardActions.ts` pasa un objeto `{ persistWorkspace: updateBoardWorkspace, onPersist: () => setStatus(...) }` literal, sin memoizar) — eso vuelve a armar el efecto de persist en cada render por si solo, sin relacion con si hay algo que persistir.
3. El efecto de hydrate SIEMPRE llama a `dispatch({type:"hydrate", ...})`
   cuando corre, confiando en que el reducer lo neutralice comparando
   `state.hydratedBoardId === action.boardId`. Es una gaurda de un solo nivel
   (dentro del reducer), no en el efecto mismo.

La combinacion de (1)+(2)+(3), disparada por el cambio de formacion (que hace
`setTeamAFormation` en el reducer local Y `updateSceneObjects` en el store en
el mismo evento), produce un ciclo hydrate<->persist que no se auto-extingue
de forma confiable y termina en "Maximum update depth exceeded" — exactamente
la Hipotesis 1 del brief original, confirmada en la practica.

La Hipotesis 2 (seleccion huerfana por IDs nuevos en cada rebuild) SI ocurre
(los tokens se reconstruyen con ids nuevos), pero no es la causa del loop: la
seleccion simplemente queda invalida sin crashear nada (`resolveBoardSelection`
devuelve `null` de forma segura). Se deja como riesgo/mejora de UX aparte, no
como parte de este hotfix.

## 3. Fix aplicado

`src/board/useBoardEditor.ts`:

- Refs (`persistWorkspaceRef`, `onPersistRef`) para las callbacks, actualizadas
  en un efecto sin guardas — asi los efectos de hydrate/persist ya NO
  dependen de la identidad de esas funciones.
- Efecto de hydrate: guarda explicita `if (state.hydratedBoardId === board.id) return;`
  ANTES de despachar — ya no dispara un `dispatch` especulativo en cada
  render solo para que el reducer lo neutralice.
- Efecto de persist: dependencia cambiada de `board` (objeto completo) a
  `boardId` (`board?.id`, primitivo) — ediciones de escena ajenas al
  workspace ya no rearman este efecto.

`src/board/boardEditorReducer.ts`: sin cambios funcionales (se agrego y luego
se removio instrumentacion temporal para el diagnostico).

Scope: solo `src/board/useBoardEditor.ts`. No se toco `boardEditorReducer.ts`
en el resultado final, ni ningun otro archivo de `src/board/*`.

## 4. Test de regresion

No hay infraestructura de render-tests en este repo (sin `jsdom`/`happy-dom`,
sin `renderHook` en uso en ningun test existente — confirmado durante FIX 2a).
Un test honesto de este bug requeriria renderizar el hook con un DOM real; no
es viable dentro del scope estricto (agregar una dependencia de test nueva)
ni del timebox P0. **Documentado como limitacion, no resuelto con un test
automatizado.** La validacion es exclusivamente en vivo (ver seccion 5).

## 5. Validacion en vivo (Playwright, clicks/selects reales)

Secuencia exacta reproducida en `fix/w1-formation-crash-hotfix` con el fix
aplicado:

1. Crear pizarra nueva (roster demo, 11 jugadores propios + rival 4-4-2).
2. Seleccionar una ficha propia (click real sobre el token, no evento
   sintetico) — confirmado en el Inspector ("Jugador propio").
3. Cambiar la formacion propia de 4-3-3 a 4-4-2 en el dropdown (select real).
4. Resultado: **0 errores de consola, 0 warnings, el board se re-renderiza
   completo con la formacion nueva**. Sin crash, sin pantalla en blanco.
5. Undo: boton "Deshacer" restaura los 11 tokens propios (nombres) al set de
   4-3-3 — el scene.objects vuelve correctamente. (Nota: la ETIQUETA del
   dropdown de formacion en si —estado local del editor de workspace— no se
   re-sincroniza con el undo del store; es un gap preexistente de
   arquitectura, no introducido por este hotfix ni por FIX 2a — el reducer de
   hydrate solo compara por `board.id`, nunca por contenido, asi que el
   undo de campos del workspace nunca estuvo cableado. Anotado como riesgo
   residual, fuera de scope del crash P0.)
