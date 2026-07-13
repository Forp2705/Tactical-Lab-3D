# PLAYBACK-DESIGN — motor de reproducción de jugada (W25A, mc-21)

Decisión del dueño (2026-07-13, verbatim): "Quiero que sea más dinámico, TODO... Quiero animaciones, movimiento." Jugada completa reproducible, no preview por acción. Este documento resuelve el modelo temporal ANTES de tocar código — se commitea solo, primero.

## 1. Flecha → qué mueve

Tabla completa de los 14 `BoardArrowSemantic` existentes, clasificados en 3 categorías:

| Categoría | Semánticas | Qué mueve |
|---|---|---|
| **ball** (pelota) | `pass`, `longPass`, `cross`, `switch`, `shot` | Solo la pelota viaja de `from` a `to`. Los tokens ancla en los extremos (pasador/receptor) NO se mueven por esta flecha — si el receptor corre, esa es una flecha `run` separada (ver §2 encadenamiento). |
| **both** (jugador + pelota juntos) | `carry` | El token `from` Y la pelota se mueven juntos por el mismo camino, mismo tiempo — la conducción es "un jugador llevándose la pelota". |
| **player** (jugador) | `movement`, `run`, `support`, `rotation`, `pressure`, `mark`, `cover`, `recovery` | Se mueve el token anclado en `from` (si `from.kind !== "object"` no hay token que animar — la flecha sigue contando para el timeline/duración pero no mueve nada). |

Regla de default (a prueba de semánticas futuras, el enum es aditivo — ver comentario en `boardModel.ts`): toda semántica que **no** esté en `ball` ni sea `carry` cae en `player` por eliminación. Nunca hace falta tocar el motor cuando se agregue una semántica nueva salvo que sea otro "ball mover" o "both mover" explícito.

Fuente de las posiciones `from`/`to` de cada tramo: **siempre** `endpointPoint(arrow.from/to, scene.objects)` (helper existente de `boardGeometry.ts`, sin duplicar resolución de anclajes) — resuelto sobre el estado DIBUJADO (estático), nunca sobre un frame animado de un tramo anterior.

**Única excepción** (corrección obligatoria de la review del coordinador, 2026-07-13, antes de codear el motor): cuando el tramo `ball` está **encadenado** (§2) a un `run`/`both` previo del receptor, su destino NO es `endpointPoint(arrow.to)` (la posición ESTÁTICA donde el receptor está dibujado) sino el `to` del tramo previo (la posición FINAL de la carrera del receptor). Un pase al desmarque tiene que buscar al jugador donde VA a estar, no donde estaba parado — si se resuelve estático, la pelota viaja a un espacio que el receptor ya abandonó y el caso estrella del brief se ve roto en pantalla. Sigue siendo una función pura de `(scene, t)`: el `to` sale de un tramo YA calculado en la misma pasada determinística, nunca de un frame animado.

## 2. Orden temporal y encadenamiento

**Default: secuencial por orden de creación** (`scene.arrows` array order — hoy no existe otro orden explícito, y no se inventa UI de timeline de edición en esta ola).

**Excepción — encadenamiento en paralelo:** si la flecha `i` es un mover `player` o `both` cuyo token origen (`from`, anclado a objeto) es el MISMO objeto que el endpoint `to` (anclado a objeto) de la flecha `i+1`, que es un mover `ball` — entonces la flecha `i+1` arranca al mismo tiempo que la flecha `i` (en paralelo), no cuando la `i` termina. Este es el caso literal del brief: "el desmarque del receptor corre en paralelo con el pase que lo busca, si están encadenados por el mismo token" — el receptor arranca a correr, y en el mismo instante el pasador suelta el balón hacia donde va a llegar.

Fuera de ese caso puntual (mover-jugador seguido de un pase QUE LO BUSCA), todo es secuencial: la flecha `i+1` arranca cuando termina la `i`. No se generaliza a otros patrones de solapamiento — es la única inferencia que pide el brief, y generalizar de más sin un caso de uso concreto es sobre-construir.

**Sincronización de llegadas (refinamiento adoptado):** en vez de que el pase arranque simplemente al mismo tiempo que el run (arranque en paralelo), el pase arranca lo más tarde posible para que la pelota LLEGUE al mismo tiempo que el receptor — `start_ball = end_run - duración_ball`, clampeado a `>= start_run` (nunca puede salir antes de que el receptor arranque a correr). Es la semántica futbolística real de un pase al espacio: el pasador no suelta la pelota hasta que el timing de la carrera lo justifica. Cuando el pase es más largo que la carrera (el clamp entra en juego), el arranque colapsa al arranque simultáneo simple — mismo resultado que la versión no sincronizada, sin caso especial adicional en el algoritmo.

Algoritmo (determinístico, sin estado mutable fuera de la función):

```
cursor = 0              // proximo arranque para una flecha NO encadenada
previousArrow = null
previousSegment = null  // el tramo YA calculado del arrow anterior (from/to/start/end)
para cada arrow en scene.arrows (en orden):
  kind = classify(arrow.semantic)
  from = endpointPoint(arrow.from, scene.objects) — SIEMPRE estatico
  chained = previousArrow existe
            && classify(previousArrow.semantic) es "player" o "both"
            && previousArrow.from.kind === "object"
            && arrow (actual).to.kind === "object"
            && classify(arrow.semantic) === "ball"
            && previousArrow.from.objectId === arrow.to.objectId
  // Unica excepcion al endpoint estatico (correccion obligatoria, ver §1):
  to = chained ? previousSegment.to : endpointPoint(arrow.to, scene.objects)
  duration = computeDuration(kind, arrow.semantic, from, to)
  start = chained
    ? max(previousSegment.end - duration, previousSegment.start)  // sync de llegada
    : cursor
  end = start + duration
  cursor = max(cursor, end)
  previousArrow = arrow; previousSegment = { from, to, start, end, ... }
duration total = cursor
```

## 3. Duraciones (determinísticas, derivadas de distancia)

Distancia en el espacio normalizado 0-100 (mismo que usa `distance()` de `boardGeometry.ts` — la geometría vive ahí, el render es quien escala a 0-64 después; nunca al revés). `duration = clamp(distance / speed, MIN, MAX)`.

Velocidades por semántica (unidades del pitch normalizado / segundo — pensadas para que la pelota se sienta viva y el jugador corra a paso humano, no arrastre):

| Semántica | Velocidad | Categoría |
|---|---|---|
| `shot` | 95 | ball — el disparo es la acción más explosiva |
| `pass` | 65 | ball |
| `cross` | 62 | ball |
| `longPass` | 60 | ball |
| `switch` | 58 | ball |
| `run` | 24 | player — el desmarque es el movimiento más vivo del bloque jugador |
| `pressure` | 22 | player |
| `movement` | 20 | player |
| `mark` | 20 | player |
| `recovery` | 20 | player |
| `cover` | 18 | player |
| `support` | 18 | player |
| `rotation` | 16 | player — reposicionamiento, el más pausado |
| `carry` | 15 | both — conducir controlando la pelota es más lento que un pase o que correr sin ella |

Pisos/techos (nunca un tramo colapsa a ~0s ni se arrastra eterno):

- **ball**: mínimo 0.35s, máximo 2.2s.
- **player** / **both**: mínimo 0.5s, máximo 3.5s.

Todo esto es constante y puro — mismo input, mismo output siempre (requisito de determinismo del TDD).

## 4. Easing

Ease-in-out cuadrático (`t<0.5 ? 2t² : 1-(-2t+2)²/2`) aplicado al progreso LOCAL de cada tramo (0 en su `start`, 1 en su `end`) antes de interpolar la posición — nada de movimiento lineal robótico. Una sola curva para todos los tramos (ball/player/both): "la pelota con velocidad más viva" se logra con la tabla de velocidades de §3 (65-95 vs 15-24), no con una curva de easing distinta — más simple, más fácil de testear con determinismo, y ya cumple lo que pide el brief literalmente ("ease-in-out por tramo").

## 5. Qué pasa al terminar / scrub

- **Al terminar** (t >= duración total): cada objeto que tuvo al menos un tramo queda en la posición `to` de su ÚLTIMO tramo (no vuelve a su posición dibujada sola). Un objeto sin tramos asignados (p. ej. un rival sin flecha propia) se queda en su posición estática de siempre.
- **Reset**: volver a t=0 muestra exactamente las posiciones dibujadas originales (`endpointPoint` del `from` del primer tramo de cada objeto == su `position` en `scene.objects`, por construcción) — no hace falta un camino de código aparte, es la misma función `samplePlayback` evaluada en t=0.
- **Scrub bidireccional**: gratis por diseño — `samplePlayback(scene, t)` es una función pura de `t` (sin memoria de "hacia dónde veníamos"), así que evaluarla en cualquier `t` dentro de `[0, duración]` (o afuera, clampeado) da el frame correcto sin importar si se viene de adelante o de atrás.
- **La escena dibujada nunca se toca**: `samplePlayback` no escribe nada — es lectura pura sobre `scene`. El playback es 100% una capa de presentación por encima; nada se persiste ni comitea.
- **Lecturas (`deriveTacticalReads`)**: siguen consumiendo `scene` (el estado dibujado/estático) sin importar si el playback está corriendo — nunca las posiciones interpoladas de un frame animado. Fabricar una lectura sobre un frame en movimiento violaría la doctrina medición≠fabricación (una posición "a mitad de camino" no es una posición táctica real, es una animación).

## 6. Contrato del motor (`src/board/boardPlayback.ts`)

```ts
export type PlaybackMoveKind = "ball" | "player" | "both";

export type PlaybackSegment = {
  arrowId: string;
  kind: PlaybackMoveKind;
  // objectIds que este tramo mueve (1 para ball/player, 2 para "both": [tokenId, ballId]).
  // Vacio si la flecha no tiene token anclado que animar (from es un punto libre).
  objectIds: string[];
  start: number; // segundos
  end: number;   // segundos
  from: BoardPoint;
  to: BoardPoint;
};

export type PlaybackTimeline = {
  segments: PlaybackSegment[];
  duration: number; // segundos, 0 si no hay flechas
};

export function buildPlaybackTimeline(scene: BoardScene): PlaybackTimeline;

export type PlaybackFrame = {
  duration: number;
  // Solo objetos afectados por al menos un tramo (los demas objetos de la
  // escena se quedan en su BoardObject.position original — el caller hace
  // el merge, el motor no repite lo que ya esta en la escena).
  positions: Record<string, BoardPoint>;
  // Progreso 0..1 de cada flecha en el instante t (0 antes de empezar, 1
  // despues de terminar) — insumo para resaltar visualmente la accion activa.
  arrowProgress: Record<string, number>;
};

export function samplePlayback(scene: BoardScene, tSeconds: number): PlaybackFrame;
```

Cero estado, cero render, cero imports de React — función pura de `(scene, t)`, testeable con fixtures de escena sin montar nada.

## 7. Superficie / UI (no motor, contrato con la capa de presentación)

- Controles en el footer del board (`rombo-playback-*`, nada flotante sobre el pitch — invariante W4): play/pausa, scrub (range input 0..duration), velocidad 1×/2×.
- rAF corre SOLO mientras `isPlaying === true`; en pausa/idle, cero rAF (el board hoy no tiene loop de render y así sigue en reposo).
- Editar durante playback (cualquier gesto de dibujo/drag/selección) pausa automáticamente y vuelve `playbackTime` a 0 — la vista vuelve al estado editable de inmediato, sin frame animado a medio camino confundiendo la edición.
- El render de los TOKENS/pelota usa la posición animada cuando hay playback activo (`positions[object.id] ?? object.position`); las FLECHAS (líneas) siempre se dibujan con las posiciones estáticas de `scene.objects` — el plan queda fijo, las fichas se mueven encima.
