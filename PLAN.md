# PLAN — FIX 2a: Merge seguro al cambiar formación (mc-21 / Ola 1)

Branch: `fix/w1-formation-merge` desde `origin/main` (1bad717).

## 1. Problema

`applyOwnFormation` (`src/board/useBoardActions.ts:288-311`) descarta todos los
`playerToken` de la escena y los reconstruye desde `roster` + `formationPoints`
vía `tokenFromPlanningPlayer`/`createPlayerToken`. Cualquier edición manual
hecha en el Inspector (rol, nota, número) se pierde en silencio al tocar el
dropdown de formación.

## 2. Semántica del merge elegida

Se agrega una función pura `mergeFormationTokens(previousTokens, nextTokens)`
en `src/board/boardTools.ts` (scope permitido por el brief: "helper en
boardTools.ts si el merge lo necesita").

- **Clave de match**: `linkedPlayerId`. Se arma un `Map` de los tokens propios
  previos indexados por `linkedPlayerId` (solo los que lo tienen).
- **Para cada token nuevo** (ya construido con la posición de la formación
  elegida):
  - Si `linkedPlayerId` es truthy y hay un token previo con el mismo
    `linkedPlayerId` → el token resultante toma `role`, `note` y `number`
    **del token previo**, y todo lo demás (posición, `label`, `rosterLink`,
    `linkedPlayerId`, `id`) del token nuevo.
  - Si no hay match → el token nuevo se usa tal cual (sin merge).
- **Preservación incondicional, no heurística de "editado vs default"**: el
  brief autoriza explícitamente esta simplificación cuando distinguir
  "editado" de "default" es ambiguo (no hay forma limpia de saber si
  `role`/`note`/`number` del token previo fueron tocados a mano por el DT o
  quedaron con el valor que puso la formación anterior). Se preserva siempre
  que haya match. Trade-off aceptado: un `role` que provenía del slot de la
  formación anterior (p.ej. "Lateral derecho") puede sobrevivir a un cambio de
  formación aunque el nuevo slot sea otro (p.ej. "Central") si el usuario
  nunca lo tocó a mano. Es preferible a la pérdida total actual; el DT puede
  volver a editarlo en un click. Documentado también como comentario junto a
  `mergeFormationTokens`.
- **No incluido en el merge**: `label` (nombre mostrado). El brief solo pide
  preservar `role`/`note`/`number`; `label` sigue el nombre del roster vía el
  token nuevo. Si un DT renombró manualmente una ficha desde el Inspector
  (campo "Nombre"), ese edit puntual se sigue perdiendo al cambiar de
  formación — riesgo residual anotado, fuera del alcance explícito del brief.
- **Posición**: siempre la del token nuevo (cambiar de formación es pedir
  posiciones nuevas — eso es intención, no pérdida, según el brief).

### Límite documentado (enmienda mc-99): tokens sin `linkedPlayerId`

Cuando el roster tiene menos jugadores que slots de la formación, los slots
sobrantes se crean con `createPlayerToken(null, ...)`, que deja
`linkedPlayerId` sin definir. Estos tokens **no son preservables** por este
merge: no hay clave estable para matchearlos entre reconstrucciones (dos
tokens sin id no son distinguibles entre sí). Esto queda fijado por un test
explícito (`tests/boardTools.test.ts`) que verifica que un token editado con
`linkedPlayerId: undefined` NO sobrevive al cambio de formación — es
comportamiento deliberado, no un bug pendiente.

## 3. `applyOpponentFormation` — NO se toca

`createOpponentShape`/`createOpponentToken` no asignan `linkedPlayerId` a los
tokens rivales (no están ligados a un roster; se indexan solo por posición
dentro del array). Aplicar el mismo helper `mergeFormationTokens` sería un
no-op real (cero matches posibles, porque la clave siempre es `undefined`)
sin resolver nada — y armar una clave alternativa (por índice, por rol) es un
cambio de semántica más grande, fuera del "sale gratis con el mismo helper"
que autoriza el brief. Se deja como **riesgo residual anotado**: las
ediciones manuales de un token rival (nota, `isDangerPlayer`) se siguen
perdiendo al cambiar la formación del rival.

## 4. Undo

`applyOwnFormation` sigue llamando a `updateSceneObjects(objects, record)`
con el mismo `record` por defecto (`true`) que antes — no se toca
`pushHistory`, `commitBoard`, `commitScene`, `undo` ni `redo`. El cambio de
formación sigue empujando una entrada de historial exactamente igual que
antes del fix; el fix solo cambia QUÉ objetos se pasan a `updateSceneObjects`,
no CÓMO se registra la historia.

**Gap de test declarado**: `history`/`future`/`undo`/`redo` viven como
`useState` local dentro del hook `useBoardActions` (no en el store Zustand),
y no hay infraestructura de test de hooks en este repo — no hay `jsdom` ni
`happy-dom` instalados, y `@testing-library/react`'s `renderHook` los
necesita. Instalar una nueva dependencia de test está fuera del scope
estricto del brief (`useBoardActions.ts` + `boardTools.ts` + tests de board,
"nada más" — un nuevo devDependency + cambio de entorno de test es un cambio
de superficie mayor, no un test acotado).

En su lugar, se testea la propiedad concreta que hace que el undo-por-
snapshot sea seguro: **`mergeFormationTokens` no muta sus inputs**. El
historial (`pushHistory`) guarda el `board` actual por referencia (sin clonar
profundo); si el merge mutara en el lugar algún token del array
`previousTokens` (que es literalmente `scene.objects` del board que puede
estar viviendo dentro de `history`), corrompería una entrada de historial ya
guardada y el undo mostraría datos incorrectos. El test verifica que los
objetos de `previousTokens` conservan su identidad estructural (mismos
valores) después de llamar a la función — es la precondición real de la que
depende el undo, testeada sin necesitar renderizar el hook.

Verificación manual complementaria (no automatizada): cambiar formación,
click en "Deshacer" en la topbar, confirmar visualmente que la escena vuelve
al estado previo. Se documenta en el reporte final si se ejecuta.

## 5. Tests (`tests/boardTools.test.ts`, agregado a los existentes)

1. Token con `linkedPlayerId` + `role`/`note`/`number` editados manualmente →
   `mergeFormationTokens` con el token nuevo de la formación → el resultado
   conserva `role`/`note`/`number` del previo y adopta la posición del nuevo.
2. Token con `linkedPlayerId: undefined` (roster más corto que la formación)
   con edits manuales → `mergeFormationTokens` → el resultado es el token
   nuevo tal cual (edits NO sobreviven) — comportamiento deliberado.
3. `mergeFormationTokens` no muta los objetos de `previousTokens` (deep-equal
   antes/después de la llamada) — precondición de seguridad del undo.
4. (Extra, cobertura de regresión) Token nuevo sin match en absoluto (roster
   creció, `linkedPlayerId` nuevo) pasa sin cambios.

## 6. Archivos a tocar

- `src/board/boardTools.ts` — nueva función `mergeFormationTokens`.
- `src/board/useBoardActions.ts` — `applyOwnFormation` usa el helper en vez de
  reemplazar directo.
- `tests/boardTools.test.ts` — casos nuevos (archivo existente, se extiende).

Nada de `applyOpponentFormation`, nada de componentes, nada de schemas.

## 7. Validación

```
npm run type-check
npm run build
npm test -- --run
npm test -- --run tests/board*.test.ts tests/sketch*.test.ts tests/scenario*.test.ts
```

Guard EOL: `git diff --stat` antes de cada commit; si aparece un archivo con
diff de línea completa (no incremental), parar y escalar.
