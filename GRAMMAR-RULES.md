# GRAMMAR-RULES.md — Gramática táctica de la Pizarra (mc-22, W25B)

**Directiva del dueño (2026-07-13, verbatim):** "Quiero lógica en cuanto a lo
que puedas hacer, no podés poner 20 veces desmarque, por ejemplo."

**Decisión de producto (mixto por gravedad):** lo imposible en una cancha se
**BLOQUEA** con una razón visible; lo dudoso — probable pero no descartable —
se **ADVIERTE** sin impedir dibujarlo. No convertimos todo en warning por
comodidad, ni todo en block por celo: cada regla de abajo está clasificada
por su propio peso futbolístico, no por facilidad de implementación.

Este catálogo es el contrato que implementa `src/board/boardTacticalGrammar.ts`.
Cualquier cambio de regla o de umbral empieza acá, no en el código.

---

## Principios de diseño

1. **La razón siempre habla en lenguaje de cuerpo técnico.** Nunca "invalid
   arrow kind" o "constraint violation" — siempre algo que un DT diría en la
   pizarra ("el 9 ya tiene un desmarque marcado en esta escena").
2. **El motor es puro y determinístico.** Mismo input, mismo veredicto. Cero
   IA, cero heurística difusa, cero import del coach.
3. **BLOCK es para lo que no puede pasar en una cancha real** (dos cuerpos en
   el mismo lugar al mismo tiempo, un jugador pasándose la pelota a sí mismo,
   una secuencia de balón que salta a alguien que nunca la tocó). **WARN es
   para lo que sí puede pasar pero probablemente no es lo que el DT quiso
   decir** (acumulación, saturación visual, mezcla de intención).
4. Los campos usados para decidir (`semantic`, `from`/`to`) son la fuente
   autoritativa de cada flecha. La gramática nunca lee `arrow.layer` para
   clasificar ofensivo/defensivo — ese campo es un cache derivado en la
   creación (`layerForArrow`) que no se resincroniza si el usuario cambia la
   semántica de una flecha ya creada (ver `arrowSemanticPatch` en
   `boardModel.ts`), así que confiar en él aquí introduciría un veredicto
   basado en un dato potencialmente stale.

---

## BLOCK — imposible / incoherente duro

### B1. Doble movimiento simultáneo del mismo jugador

Un jugador no puede ejecutar dos desmarques/movimientos libres a la vez en la
misma escena — es una sola persona, un solo cuerpo. Si ya existe una flecha
de tipo `movement` o `run` que sale de ese token, una segunda flecha del
mismo grupo desde el mismo origen se bloquea.

`support` y `rotation` quedan **fuera** de este grupo a propósito: un
"apoyo" no es un desmarque (es una intención de posicionamiento, puede
convivir con un desmarque ya marcado sin ser contradictorio) y una
"rotación" ya es su propia semántica de intercambio, no una segunda carrera
libre. Ampliar el grupo a estas dos habría bloqueado combinaciones legítimas
que un DT sí dibuja (p.ej. un desmarque + un apoyo del mismo interior en
instantes distintos de la misma fase).

- Grupo: `movement`, `run`.
- Ejemplo de razón: "El 9 ya tiene un desmarque o movimiento marcado en esta
  escena: no puede hacer dos a la vez."

### B2. Flecha duplicada exacta

Mismo origen, mismo destino, misma semántica ya existe en la escena. Dibujar
la idéntica de nuevo no agrega información, es un accidente de gesto (doble
click, drag repetido) más que una decisión táctica.

- Ejemplo de razón: "Esa misma acción ya está dibujada, igual, en esta
  escena."

### B3. Pase/acción con origen y destino en el mismo jugador

Una flecha que empieza y termina en el mismo token no representa ninguna
acción real (no existe un "pase a uno mismo"). Nota: el gestor de gesto de
flechas (W24A, `stepArrowGestureOnPointerDown/Up`) ya intercepta este caso
como cancelación silenciosa cuando se dibuja por drag o click-click — esta
regla es la red de seguridad del motor para cualquier otra vía de creación o
edición de una flecha (p.ej. el inspector cambiando la zona/objeto destino),
y también documenta el invariante para los tests directos de
`evaluateAction`.

- Ejemplo de razón: "El origen y el destino son el mismo jugador: no tiene
  sentido dibujar esta acción así."

### B4. Acción de balón encadenada desde un jugador que no interviene

Si ya hay una secuencia de balón dibujada en la escena (`pass`, `longPass`,
`cross`, `switch`, `carry`, `shot`), una nueva acción de balón solo puede
salir de un jugador que **ya intervino** en esa secuencia: o fue origen de
alguna acción de balón anterior, o fue el destino de una. Si el origen
propuesto nunca tocó la pelota en esta escena, la cadena no tiene sentido
(la pelota no puede "teletransportarse" a sus pies).

Definición de "interviene" — deliberadamente simple: **estructural, no
geométrica.** No se mide distancia al balón en el canvas (eso repetiría el
mismo riesgo de "adivinar por posición" que `boardTacticalRead.ts` prohíbe
para decidir lateralidad); se mide participación declarada en flechas de
balón ya dibujadas. La primera acción de balón de una escena siempre es
válida sin importar quién la inicie (no hay cadena previa que romper — puede
representar el saque del arquero, una recuperación, etc., y el motor no
tiene forma honesta de saber quién "tiene" la pelota sin una flecha previa
que lo declare).

- Ejemplo de razón: "El 6 no participó antes en esta jugada con el balón: no
  puede continuarla."

---

## WARN — dudoso / probablemente error

### W1. Acumulación del mismo tipo de acción en la escena

**Umbral: 4 o más flechas de la misma semántica en una escena dispara el
aviso** (hasta 3 se permite sin aviso). Criterio futbolístico, no
arbitrario: una escena coreografiada típica ilustra una conducta compartida
por una línea o un grupo reducido — por ejemplo, un tridente ofensivo
haciendo el mismo desmarque en profundidad son 3 jugadores, un doble pivote
rotando son 2. Pasado ese tamaño (4+), ya no es "una idea repetida por un
grupo reconocible de la cancha": empieza a ser ruido visual o una
generalización perezosa ("todos hacen desmarque"), que es exactamente el
caso que el dueño señaló ("no podés poner 20 veces desmarque").

- Ejemplo de razón: "Hay 4 acciones de \"Desmarque\" en esta escena: revisa
  si cada una representa una conducta distinta o si conviene simplificar."

### W2. Muchas acciones apiladas en el mismo token

**Umbral: 4 o más flechas que salen del mismo jugador.** Un token es legible
con hasta 2-3 acciones simultáneas (p.ej. un lateral con un desmarque, un
apoyo y una cobertura marcados a la vez ya es denso pero legible); la cuarta
acción sobre el mismo jugador generalmente supera lo que un jugador puede
leer de un vistazo en la pizarra.

- Ejemplo de razón: "El 4 concentra 4 acciones en esta escena: puede
  volverse difícil de leer para el jugador."

### W3. Acciones ofensivas y defensivas mezcladas en el mismo token

Un mismo jugador con al menos una acción ofensiva (`movement`, `run`,
`pass`, `longPass`, `cross`, `switch`, `carry`, `support`, `rotation`,
`shot`) y al menos una defensiva (`pressure`, `cover`, `recovery`, `mark`)
en la misma escena es normalmente un error de gesto (se dibujó con la tool
equivocada) o una confusión de fase (una escena debería representar un
momento del juego, no dos roles opuestos del mismo jugador a la vez) — pero
no es imposible: un lateral puede tener un movimiento ofensivo dibujado y
una cobertura defensiva anotada como "lo que hace después" dentro de la
misma fase. Por eso es warning, no block.

- Ejemplo de razón: "El 4 tiene una acción ofensiva y una defensiva marcadas
  en la misma escena: confirmá si es la idea o es una mezcla accidental."

---

## Resumen de umbrales

| Regla | Severidad | Umbral |
|---|---|---|
| B1 doble movimiento | block | 1 previo del mismo grupo ya bloquea el 2do |
| B2 flecha duplicada | block | exacta (mismo origen/destino/semántica) |
| B3 origen=destino | block | siempre |
| B4 balón ajeno a la secuencia | block | desde la 2da acción de balón en adelante |
| W1 acumulación por tipo | warn | ≥4 del mismo `semantic` en la escena |
| W2 acumulación por token | warn | ≥4 flechas que salen del mismo token |
| W3 mezcla ofensiva/defensiva | warn | 1 de cada grupo en el mismo token |

Total: 4 BLOCK + 3 WARN = 7 reglas (dentro del rango 6-10 pedido).
