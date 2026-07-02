# PLAN — Entrega A: estados explicitos del board (mc-21 / Ola 2)

Branch: `fix/w2-board-states` desde `origin/main` (10bcbc4).

## A1 — Escena fantasma -> estado explicito

### Bug actual

`resolveActiveScene` (`src/board/boardViewModel.ts:24-33`) colapsa DOS casos
distintos en el mismo fallback:

- `activeBoardSceneId === null` (nadie pidio una escena especifica) -> cae a
  `scenes[0]`. Correcto, intencional.
- `activeBoardSceneId` es un id concreto que no matchea ninguna escena
  (fantasma: la escena fue borrada/movida pero algo todavia apunta a su id)
  -> TAMBIEN cae a `scenes[0]`, en silencio. Esto es lo que hay que cortar:
  el usuario/flujo pidio una escena especifica que ya no existe, y el sistema
  le muestra OTRA escena sin avisar.

`openTacticalBoard` (`src/state/useAppStore.ts:1006-1024`) agrava el mismo
patron un nivel mas arriba: si le pasan un `sceneId` invalido, sustituye por
`scenes[0]?.id` ANTES de guardarlo en el store — asi que `activeBoardSceneId`
nunca llega a tener un id fantasma en primer lugar, y `resolveActiveScene`
nunca ve el caso que se supone debe manejar.

### Fix

1. `useAppStore.ts` (cambio minimo autorizado, zona sensible): en
   `openTacticalBoard`, dejar de sustituir un `sceneId` explicito invalido.
   Solo guardarlo tal cual. La unica sustitucion que sobrevive es la de "no
   me pidieron nada" (`sceneId === undefined`) -> primera escena.
   ```ts
   const activeBoardSceneId =
     sceneId !== undefined ? sceneId : (board.scenes[0]?.id ?? null);
   ```
   Nota: se cambia el chequeo de `sceneId && board.scenes.some(...)` (que
   colapsaba "no pedido" con "pedido pero invalido") a `sceneId !== undefined`
   (distingue ambos). Un id invalido explicito ahora SI se guarda como esta.

2. `boardViewModel.ts`: `resolveActiveScene` distingue los 3 casos en vez de
   comprimirlos en un solo `??`:
   ```ts
   export function resolveActiveScene(board, activeBoardSceneId) {
     if (!board) return null;
     if (activeBoardSceneId === null) return board.scenes[0] ?? null;
     return board.scenes.find((item) => item.id === activeBoardSceneId) ?? null;
   }
   ```
   Resultado: id fantasma explicito -> `null` (antes: `scenes[0]` en silencio).

3. `tests/boardViewModel.test.ts:39-43`: el test actual FIJA el bug como
   contrato (`resolveActiveScene(board, "ghost")` espera `board.scenes[0]`).
   Se corrige para esperar `null`, y se agregan casos para los 3 escenarios
   (found / no-request-null / ghost-id).

4. `TacticalBoardView.tsx`: hoy `!board || !scene` cae al mismo
   `TacticalBoardEmptyState` (pensado para "no hay pizarra"). Se separa:
   - `!board` -> `TacticalBoardEmptyState` (como hoy).
   - `board` valido pero `!scene` (fantasma) -> nuevo componente
     `TacticalBoardGhostSceneState` (`src/board/components/`), con mensaje
     distinto ("la escena que se pidio abrir ya no existe") y una sola
     accion: "Abrir la primera escena" -> `openTacticalBoard(board.id, board.scenes[0]?.id)`.

### Por que el cambio en useAppStore es minimo y seguro

Los 4 call-sites de `openTacticalBoard` con `sceneId` explicito
(`useBoardActions.ts`: `addScene`, `deleteCurrentScene`, `selectScene`;
`SessionsView.tsx`: abrir board+escena vinculados a un bloque de sesion) pasan
siempre ids que existen en el momento del call, EXCEPTO el de sesiones, que es
justamente el caso real de fantasma (un bloque de sesion vinculado a una
escena que despues se borro). Con el fix, ese caso ahora se ve honestamente
en vez de aterrizar en una escena random sin avisar — es la mejora, no una
regresion.

## A2 — `applyOpponentFormation`: contrato explicito (replace-total)

### Decision

Los tokens rivales (`createOpponentToken`/`createOpponentShape`) NO tienen
`linkedPlayerId` NI ninguna identidad estable entre reconstrucciones: se
indexan solo por posicion dentro del array de la formacion actual (`number:
index + 1`). A diferencia de los tokens propios (que tienen `linkedPlayerId`
= id del jugador del roster, una identidad real e independiente de la
formacion), un token rival no representa a "una persona" sino a "un rol
posicional dentro de ESTA formacion". Cambiar de formacion cambia el
significado de cada indice (el slot 5 en 4-4-2 es un lateral; el slot 5 en
4-2-3-1 puede ser un doble pivote) — matchear por indice preservaria
`note`/`isDangerPlayer` en el LUGAR EQUIVOCADO cuando el rol cambia, que es
peor que perderlos (dato mal atribuido en silencio, vs. dato ausente y
honesto).

**Contrato elegido: replace-total, documentado explicitamente** (igual que el
caso `linkedPlayerId: undefined` de FIX 2a). No se agrega ninguna clave de
match para rivales. Se documenta con un comentario junto a
`applyOpponentFormation` y se fija con un test explicito en
`tests/board.test.ts` que prueba que `createOpponentShape` nunca hereda
`note`/`isDangerPlayer` de una llamada anterior (no puede — no recibe tokens
previos como input — el test lo deja como contrato verificado, no supuesto).

## A3 — Error boundary local de la Pizarra

Componente nuevo `src/board/components/TacticalBoardErrorBoundary.tsx` (class
component — los error boundaries de React requieren clase, no hay equivalente
de hook). Envuelve `<TacticalBoardWorkspace>` dentro de `TacticalBoardView.tsx`
(no toca `AppShell`/`App.tsx`).

- `getDerivedStateFromError` marca `hasError: true` — el subarbol crasheado
  se desmonta (comportamiento estandar de React), evitando que el error se
  propague hacia arriba y deje la vista completa en blanco.
- `componentDidCatch` loguea a consola (unico canal disponible hoy; no hay
  telemetria de errores en el cliente).
- Estado de error: texto sobrio en espanol + boton "Recargar la pizarra" que
  limpia `hasError`. Como React ya desmonto el subarbol crasheado al
  atraparlo, volver a renderizar `children` crea instancias frescas — es un
  remount real, no hace falta un truco de `key` adicional.
- Estilo: reusa la clase `rombo-board-empty` (mismo lenguaje visual que los
  otros estados vacios) para quedar "semanticamente correcto y austero" sin
  invadir el trabajo de pulido de mc-18.

## Archivos tocados

- `src/state/useAppStore.ts` (cambio minimo puntual en `openTacticalBoard`).
- `src/board/boardViewModel.ts` (`resolveActiveScene`).
- `src/board/TacticalBoardView.tsx` (bifurcacion del estado vacio + wiring
  del error boundary).
- `src/board/components/TacticalBoardGhostSceneState.tsx` (nuevo).
- `src/board/components/TacticalBoardErrorBoundary.tsx` (nuevo).
- `src/board/useBoardActions.ts` (comentario de contrato en
  `applyOpponentFormation`; sin cambio de comportamiento).
- `tests/boardViewModel.test.ts` (corrige el test que fijaba el bug + casos
  nuevos).
- `tests/board.test.ts` (test de contrato replace-total para
  `createOpponentShape`).

No se toca `tests/` de mc-20 (render tests del board en paralelo).

## Validacion

```
npm run type-check
npm run build
npm test -- --run
npm test -- --run tests/board*.test.ts
```

En vivo (Playwright, UI real):
1. Escena fantasma: forzar `activeBoardSceneId` a un id inexistente via
   `useAppStore.getState()` en consola del navegador (no hay UI nativa hoy
   para llegar a este estado salvo el caso de sesiones con escena borrada) y
   confirmar el nuevo estado + que "Abrir la primera escena" funciona.
2. Formacion rival con ediciones (nota/peligroso) -> cambiar formacion rival
   -> confirmar que se resetea (contrato, no bug).
3. Throw simulado temporal (no commiteado) dentro del workspace del board
   para confirmar que el error boundary atrapa y muestra "Recargar la
   pizarra" en vez de pantalla en blanco; revertido antes de commitear.

Guard EOL: `git diff --stat` antes de cada commit.
