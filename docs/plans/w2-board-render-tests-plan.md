# PLAN — mc-20 Ola 2: Render tests para la clase de crash de useBoardEditor

Branch: `test/w2-board-render-tests` desde `origin/main` (`10bcbc4`, post-hotfix PR #12).

## 0. Que se prueba y por que

`docs/plans/w1-fix2a-hotfix-plan.md` documenta el bug (ping-pong hydrate<->persist
en `useBoardEditor` -> "Maximum update depth exceeded" -> `TacticalBoardWorkspace`
se desmonta) y su fix (refs para las callbacks + guard de hidratacion por
`board.id` antes de despachar + efecto de persist dependiendo de `boardId`
primitivo, no del objeto `board` completo). Ese mismo plan dice explicitamente
que no hubo test de regresion porque no habia infraestructura de render tests
en el repo. Esta ola cierra ese hueco.

Dos angulos complementarios, no redundantes:

- **T2 (arbol completo)**: monta `TacticalBoardView` real con el store real,
  reproduce el flujo EXACTO que crasheaba en vivo (crear pizarra -> seleccionar
  ficha -> cambiar formacion), y afirma el contrato de FIX 2a a nivel UI
  (sobrevive la nota/rol de una ficha vinculada a roster).
- **T3 (hook aislado)**: `renderHook` sobre `useBoardEditor` con el patron de
  churn EXACTO que causaba el loop (nueva identidad de `board` y de las
  callbacks `persistWorkspace`/`onPersist` en cada render, tal cual lo hace el
  caller real sin memoizar) y afirma cuentas de llamadas — esto es lo que un
  test de arbol completo no puede afirmar con precision (cuantas veces se
  disparo persist), y es el nivel exacto donde vive el fix.

## 1. T1 — Infra minima

- Pragma por archivo `// @vitest-environment jsdom` en los 2 archivos nuevos
  que rendericen (T2). El archivo de T3 (`renderHook` sobre un hook que no
  toca el DOM) tambien corre en jsdom por consistencia y porque
  `@testing-library/react` requiere un DOM disponible para `act`/efectos.
- `jsdom` no esta en devDependencies (verificado: `npm ls jsdom` -> vacio).
  Se agrega pinneado (version exacta, no rango) como devDependency nueva —
  unica dependencia nueva de esta ola.
- `@testing-library/react` (`^16.2.0`) ya esta en devDependencies sin uso real
  en el repo (solo `renderToStaticMarkup` de `react-dom/server` se usaba antes,
  en `tests/weeklyCoachImmediacy.test.tsx` — no es RTL). Esta ola es el primer
  uso real de `render`/`renderHook`/`fireEvent`/`act` de RTL en el repo.
- NO se toca `vite.config.ts`: el pragma por archivo alcanza (Vitest 3 soporta
  `// @vitest-environment <name>` por archivo sin config global). Si algun
  test T2 necesita algo que el pragma no cubre, se documenta como riesgo antes
  de tocar el config compartido (no se toca preventivamente).
- Guard de red offline (`tests/setup/networkGuard.ts`, via `setupFiles`
  global): sigue aplicando a todos los archivos sin importar el environment
  (jsdom o node) porque Vitest corre `setupFiles` por archivo de test
  independientemente del `environment` declarado. Se verifica en la corrida
  final que ningun test nuevo dispara el guard (no deberian llamar `fetch`:
  `onAskCoach` del board solo se dispara por accion explicita de "Preguntar
  al coach", que ningun test nuevo toca).

## 2. T2 — Cubrir la clase del crash (arbol completo)

Archivo nuevo: `tests/boardRenderCrashClass.test.tsx`.

### Por que es viable sin mocks pesados

`TacticalBoardCanvas` (el componente que dibuja jugadores/pelota/zonas) usa
`<svg>`/`<g>`/`<circle>` planos — cero Canvas 2D, cero WebGL, cero Three.js.
jsdom soporta el DOM de SVG lo suficiente para que React pueda montar y
actualizar estos nodos y para que `fireEvent.pointerDown` dispare los
handlers. Confirmado leyendo `src/board/components/TacticalBoardCanvas.tsx`
(no hay `<canvas>` ni imports de `three`). El resto del arbol
(`TacticalBoardView` -> paneles laterales) es HTML plano. **No hace falta
mockear canvas ni WebGL** — el unico mock es de dominio (ver abajo), no de
plataforma.

### Setup compartido

- `useAppStore.setState(useAppStore.getInitialState(), true)` en
  `beforeEach` (mismo patron que `tests/boardStore.test.ts`,
  `tests/snapshot.test.ts`, etc. — no es un patron nuevo).
- Seedear `team.players` con `demoPlayers.slice(0, 1)` (fixture real de
  `src/data/players.ts`, ya usada en otros tests) ANTES de crear el board —
  asi el primer token propio (slot GK) queda `linkedPlayerId`-vinculado a un
  jugador real del roster. Esto es necesario para poder afirmar la parte del
  contrato de FIX 2a ("la nota/rol sobrevive") de forma significativa: un
  token sin roster (`linkedPlayerId` null) NO deberia preservar ediciones por
  diseno (`mergeFormationTokens` en `boardTools.ts:72-94`, documentado y
  confirmado en vivo en `RECHECK-W1.md`), asi que probar solo con tokens sin
  roster daria un falso "no sobrevive" que en realidad es contrato, no bug.
- `useAppStore.getState().createTacticalBoard({ title: "Test board" })` —
  crea un board con escena default (11 tokens propios + rival 4-4-2 + pelota),
  lo activa (`activeBoardId`/`activeBoardSceneId`), sin pasar por ningun
  mock de UI de creacion.
- `render(<TacticalBoardView />)` de `@testing-library/react`.

### Caso A — flujo exacto del P0 (con seleccion)

1. Ubicar el token propio vinculado a roster: `container.querySelector('.token.own')`
   (el primero es el GK, `linkedPlayerId` = `demoPlayers[0].id`).
2. `fireEvent.pointerDown(tokenG)` — selecciona (tool por default es
   `"select"`, dispara `onCanvasPointerDown` -> `setSelection`).
3. Confirmar que el Inspector muestra el panel de "Jugador propio"
   (`getByLabelText("Rol")` visible).
4. `fireEvent.change(getByLabelText("Rol"), { target: { value: "QA-ROLE" } })`.
5. Click en el boton de formacion "4-4-2" (`getByRole("button", { name: "4-4-2" })`
   dentro del panel "Distribucion" — formacion default es "4-3-3", asi que
   "4-4-2" es un cambio real).
6. Assert (a): `console.error` no se llamo con un mensaje que contenga
   "Maximum update depth" (spy instalado antes del click, restaurado despues).
7. Assert (b): el arbol sigue montado — `screen.getByText("Pizarra tactica")`
   (heading del topbar) sigue presente, Y el canvas sigue teniendo 11 tokens
   propios (`.token.own` length === 11) tras el cambio — NO blanco, NO arbol
   parcial.
8. Assert (c) contrato FIX 2a: el token del jugador vinculado a roster, en su
   nueva posicion de 4-4-2, sigue mostrando `role` = "QA-ROLE" (releer
   `getByLabelText("Rol")` tras re-seleccionar el mismo `linkedPlayerId` por
   nombre, ya que las posiciones cambiaron).

### Caso B — variante sin seleccion

Mismo setup, sin pasos 1-4: click directo en el boton de formacion sin
seleccionar ninguna ficha antes. Assert (a) y (b) únicamente (no aplica (c),
no hay edicion previa). Este caso importa porque el reporte P0 original
listaba "variante sin seleccion" como parte del reproduce, y el recheck de
`RECHECK-W1.md` la confirmo en vivo — este test la fija.

### Riesgo documentado

Si `fireEvent.pointerDown` no alcanza a disparar el handler de React en jsdom
(SVG + eventos de puntero a veces requieren `PointerEvent` explicito, que
jsdom soporta desde v20+ de forma parcial), el fallback es
`fireEvent.click` sobre el mismo nodo — el handler real es `onPointerDown`,
asi que si `pointerDown` no alcanza el elemento se documenta en el propio
test (comentario) y se prueba primero en la implementacion, no aca.

## 3. T3 — Smoke hydrate/persist de un solo disparo (hook aislado)

Archivo nuevo: `tests/useBoardEditorHydratePersist.test.tsx`.

### Que reproduce el patron de bug exacto

El bug NO era el reducer (`boardEditorReducer.ts` no cambio en el hotfix) —
era la identidad de las dependencias de los `useEffect` del hook. Un test de
arbol completo (T2) no puede afirmar "cuantas veces se llamo persist" con
precision porque hay muchos re-renders intermedios fuera de control directo.
`renderHook` si puede.

### Diseño

```
const persistSpy = vi.fn();
const onPersistSpy = vi.fn();
const players = demoPlayers.slice(0, 1);
let board = createDefaultBoard("Test", { players });

const { result, rerender } = renderHook(
  (props: { board: TacticalBoard }) =>
    useBoardEditor(props.board, players, {
      persistWorkspace: (id, ws) => persistSpy(id, ws), // closure NUEVA cada render
      onPersist: () => onPersistSpy(),                   // closure NUEVA cada render
    }),
  { initialProps: { board } },
);
```

- **Paso 1 — hidratacion**: tras el render inicial, `result.current.roster`
  refleja el roster sembrado. `persistSpy` NO se llamo (hidratar no es
  editar).
- **Paso 2 — churn puro sin edicion**: `rerender({ board: { ...board } })`
  (misma `id`, nueva identidad de objeto — exactamente lo que Zustand produce
  en cada `set()` en cualquier parte del store) repetido 5 veces seguidas.
  Assert: `persistSpy` sigue en 0 llamadas y `dispatch`/estado no cambia de
  forma detectable (no hay re-hidratacion: si hubiera, `roster` se
  reconstruiria y perderia cualquier edicion — se verifica en el paso
  siguiente que earlier edits sobreviven exactamente por esto).
- **Paso 3 — una edicion real**: `act(() => result.current.setTeamAFormation("4-4-2"))`.
  Luego un `rerender` con nueva identidad de `board` (simulando el commit de
  `updateSceneObjects` que ocurre en el mismo evento real en
  `applyOwnFormation`). Assert: `persistSpy` fue llamado **exactamente 1 vez**
  con el `boardId` correcto.
- **Paso 4 — anti-cascada**: 5 rerenders adicionales con nueva identidad de
  `board` y nuevas closures de callback (sin ediciones nuevas). Assert:
  `persistSpy` sigue en **exactamente 1** llamada total (no se re-dispara por
  churn de identidad) — este es el assert que directamente habria fallado
  antes del hotfix (el ciclo hydrate<->persist se re-disparaba en cada churn).
- Ningun paso debe tardar mas que un timeout normal de test ni tirar
  "Maximum update depth exceeded" — si el hook todavia tuviera el bug, este
  test cuelga o tira ese error en el paso 2 o 4, antes de llegar a los
  asserts de conteo.

## 4. T4 — Matriz de regresion actualizada

Ver `VALIDATION-W2.md` (nuevo, raiz del worktree — no en `docs/plans/` porque
es un artefacto vivo de validacion, no un plan de implementacion, siguiendo el
mismo criterio que `VALIDATION-WAVE1.md`/`SMOKE-W1.md` de la ola anterior).

## 5. Scope y guard EOL

- Archivos nuevos permitidos: `tests/boardRenderCrashClass.test.tsx`,
  `tests/useBoardEditorHydratePersist.test.tsx`, este plan,
  `VALIDATION-W2.md`.
- `package.json` + `package-lock.json`: SOLO para agregar `jsdom` pinneado a
  devDependencies. Nada mas.
- `vite.config.ts`: no tocado (ver T1).
- `src/**`: NO tocado. Si algun test revela que el codigo de produccion
  necesita un ajuste para ser testeable (p.ej. faltan `data-testid`), NO se
  arregla en esta tarea — se escala al coordinador con el detalle exacto.
- Antes de cada commit: `git diff --stat` — cualquier archivo con diff de
  "todo el archivo" (CRLF/EOL) para postear como escalation en vez de
  commitear.

## 6. Validacion

`npm run type-check && npm run build && npm test -- --run` (suite completa,
tests nuevos incluidos). Se documenta el tiempo total y el delta que agregan
los 2 archivos nuevos contra el baseline conocido (85 archivos / 517 tests /
~10s en `10bcbc4`, de `SMOKE-W1.md`).
