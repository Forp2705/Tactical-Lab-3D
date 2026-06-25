# Slice 2 — Respuesta rival dibujada (raise-block)

> Continúa el feature del Board Scenario Sandbox. Spec padre:
> `2026-06-24-board-scenario-sandbox-design.md` (§9 "Slices futuras" lista esta
> dirección: *"Reacción rival dibujada/anclada (token movement) con grounding"*).
> Esta slice la convierte en diseño implementable.

## 1. Contexto y problema

El draw-back de `raise-block` (slice 1, `src/board/scenarioBoardConsequence.ts`,
`REGISTRY["raise-block"]`) ya dibuja:

- la zona `press` sobre el build-up rival,
- la zona `danger`/`freeSpace` "Espacio a la espalda" detrás de la línea de
  centrales (anclada al gap, dir-aware),
- una única flecha `longPass` "Diagonal a la espalda" anclada a **un** token
  rival → el **balón** al hueco.

Lo que falta es la **reacción rival coordinada**: subir el bloque no provoca una
amenaza suelta, provoca una respuesta de varios jugadores rivales atacando el
espacio concedido. Hoy el board muestra el balón pero no a los jugadores que lo
atacan. Slice 2 dibuja a los jugadores.

## 2. Restricción arquitectónica (decisión explícita, no implícita)

Esta slice **no puede reabrir el problema que cerró P0.2**: la proliferación de
vocabulario paralelo / capa lossy. El ancla de esa decisión vive en el código —
comentario del enum en `boardModel.ts`:

> *"Vocabulario futbolero ampliado (aditivo: boards viejos siguen parseando). La
> tool rail elige una de estas semánticas directo, sin capa lossy."*

De ahí los dos guards que gobiernan todo el slice:

**Guard 1 — un solo vocabulario.** Prohibido crear un enum nuevo para "acciones
rivales". Las acciones se expresan con `BoardArrowSemantic` existente. La
intención humana ("el 9 ataca tu espalda") vive en `label`/`tacticalMeaning`, no
en una taxonomía paralela. "Rival" se deriva del **anclaje al token rival real**
(`from: { kind: "object", objectId }` sobre un `opponentToken`), no de un campo
conceptual nuevo.

**Guard 2 — la misma maquinaria.** Reusar `ConsequenceOverlay`, `OverlayArrow`,
`createSemanticArrow`, el lifecycle accept/discard y el canal `notes[]`. Sin
overlay model nuevo, sin persistencia nueva, sin flujo UI paralelo.

## 3. Vocabulario (verificado contra `boardModel.ts:58-75`)

Enum real: `movement, pass, pressure, cover, recovery, run, rotation, longPass,
cross, switch, carry, support, mark, shot`. Mapeo conceptual → semántica
existente (labels ya provistos por `labelForArrow`):

| acción conceptual | semantic | label existente |
|---|---|---|
| `attackBack` (corre a la espalda) | `run` | "Ruptura" |
| segundo `run` / canal | `run` | "Ruptura" |
| `dropReceive` (baja entre líneas) | `support` | "Apoyo" |
| `closeWide` / `coverLane` | `cover` | "Cobertura" |
| `jumpPress` | `pressure` | "Presion" |

Para `raise-block` **el default es verticalidad** (ver §5). `support`/`cover`/
`pressure` quedan disponibles en el vocabulario pero **no** son default de este
escenario.

## 4. Las seis decisiones lockeadas

1. **Visual:** balón + jugadores **conviven** (la `longPass` se sigue
   renderizando junto a las flechas de movimiento rival).
2. **Arquitectura:** **una sola función autora el patrón rival completo**; la
   `longPass` de slice 1 se **absorbe** dentro de esa función (deja de ser un
   artefacto suelto compuesto aparte). Convivencia es visual; en código hay una
   sola fuente.
3. **Semántica:** enum existente + `intent`/`label`. Sin taxonomía paralela
   (Guard 1).
4. **Grounding:** actores rivales **reales** (anclados a `objectId`).
   Degradación honesta si faltan (§6).
5. **Táctica `raise-block`:** verticalidad primero → `longPass` (balón) + `run`
   a la espalda + segundo `run`/canal. `dropReceive` entre líneas **no** es
   default.
6. **Densidad / visibilidad:** `layer: "rival"` es **marca de agrupación**, no un
   toggle por sí solo. Hoy `layerVisibleForArrow` (`boardGeometry.ts:61-68`)
   clasifica por `arrow.semantic`, **no** por `arrow.layer` → un `run` rival
   quedaría atado a tu capa de ataque (`offensiveTransition || attack`) y un
   `longPass` rival siempre visible (mis-clasificación, no solo "no togglea").
   Fix: rama temprana `if (arrow.layer === "rival") return true;`. Sin layer de
   workspace nueva, sin mapear `rival` a `defense`, sin prometer toggle
   post-accept. Durante el **preview** el grupo se controla por el lifecycle del
   overlay (aparece en preview, se va en `discard`, se vuelve board real en
   `accept`). **No se borra el pase** para reducir densidad.

## 5. Autoría y selección determinística de actores

Una función (p.ej. `authorRaiseBlockRivalResponse(scene, dir, gap)`) compone, en
un solo lugar, balón + corredores. Reusa el `gap` ya calculado en slice 1.

**Fuente única del target (clave del invariante §7):** el centro del hueco se
calcula **una sola vez**:

```ts
const gapTarget = { x: gap.x + gap.w / 2, y: gap.y + gap.h / 2 };
```

Tanto la `longPass` como el `run` primario referencian `gapTarget`. La coherencia
se garantiza **por construcción**, no por convención.

**Selección dir-aware (geometría).** ⚠️ Los rivales atacan hacia `-dir` (opuesto
a los propios), así que **NO** se puede copiar `resolveCentreBacks` —ese helper
selecciona tokens **propios** relativos a `dir`; la profundidad rival es la
imagen espejada. Fijado sin margen:

- `dir === 1` (vos atacás +x, el rival ataca -x): **passer/build-up = mayor `x`**;
  **runner adelantado = menor `x`**.
- `dir === -1` (vos atacás -x, el rival ataca +x): **passer = menor `x`**;
  **runner adelantado = mayor `x`**.

Con esa orientación:

- **Passer (`longPass`):** el rival en build-up (con la pelota, lado profundo
  rival). `from` = ese rival; `to` = `gapTarget`.
- **Runner primario (`run`, attackBack):** el rival más adelantado hacia tu arco
  (ataca el espacio concedido). `from` = ese rival; `to` = `gapTarget`.
- **Segundo run / canal (`run`, opcional, solo ≥3 rivales):** el rival **más
  abierto** (`max |y - 50|`) entre los restantes. `from` = ese rival; `to` = un
  punto en la **misma banda detrás de la línea** que el gap pero en el carril
  lateral (geométricamente compatible, no idéntico).

Todas las flechas se crean con `createSemanticArrow(...)`, `layer: "rival"`,
`label`/`tacticalMeaning` explicando la lectura ("(lectura del modelo) El más
adelantado ataca tu espalda"), y se empujan a `overlay.arrows`.

## 6. Degradación honesta

El patrón vertical completo (passer + runner distintos) necesita **≥2 rivales**:

- **0 rivales:** sin flechas rivales; `note` "Sin rivales en la escena: no puedo
  proyectar la respuesta." (la zona del hueco y el press se siguen dibujando).
- **1 rival:** un solo token no puede ser passer y runner a la vez (serían dos
  flechas del **mismo origen al mismo `gapTarget`**, incoherente). Se dibuja
  **solo** la `longPass` (balón a la espalda, como slice 1); `note` "Solo 1
  rival: no puedo mostrar la corrida coordinada." **Sin** `run` redundante.
- **≥2 rivales:** passer ≠ runner. Segundo run solo con ≥3.

Sin tokens rivales ficticios. El panel dice qué falta (mismo patrón que P0.5 /
slice 1).

## 7. Invariante de coordinación (single coherent authoring → test)

**Invariante:** en una escena `raise-block` con rivales, `longPass.to` y la `run`
primaria `.to` resuelven al **mismo hueco**, y ambos caen **dentro** de la zona
`danger`/`freeSpace` que el mismo overlay genera. Si el balón apunta a un lado y
el corredor a otro, **el board miente** — y un refactor futuro que desacople el
pase del corredor debe fallar en CI, no en silencio (mismo modo de falla que ya
mordió en `detectAttackDir`; ver [[detectattackdir-crosscheck-followup]]).

Garantía por construcción: `gapTarget` única fuente (§5). El test guarda el
invariante contra el desacople.

## 8. Testing (unidades aisladas, TDD)

Aditivo sobre los tests de `raise-block` ya verdes (zona del hueco, press,
rivalFacts, note de centrales faltantes) — esos deben seguir pasando.

Nuevos:

1. **Respuesta rival coordinada:** escena `raise-block` con ≥2 rivales →
   `buildConsequenceOverlay` produce ≥2 flechas en `layer: "rival"` con
   semántica `longPass` y `run`, ancladas a `objectId` rivales reales.
2. **Invariante de coordinación (el lock):** misma escena → existe un `longPass`
   y un `run`; assert `longPass.to` y `run.to` apuntan al mismo gap (mismo
   `point` o distancia `< epsilon`), **y** ambos caen dentro de la zona
   `danger`/`freeSpace` del overlay (vía `isInsideZoneRect`). Si se desacoplan,
   falla.
3. **Degradación 1 rival:** escena con 1 rival → `longPass` presente + `note`
   parcial + assert que **NO** hay ninguna `run` en `layer: "rival"` (el token
   único no se dibuja como corredor redundante).
4. **Degradación 0 rivales:** sin rivales → sin flechas `layer: "rival"` +
   `note`; la zona del hueco y el press se siguen dibujando.
5. **Layer:** las flechas rivales llevan `layer: "rival"` (para que el toggle
   existente las controle).

## 9. Fuera de alcance (YAGNI explícito)

- Enum/taxonomía nueva (Guard 1).
- `ghosts` finales (tokens fantasma en posición final) — solo flechas.
- Animación / transición temporal.
- Orden temporal / secuencia entre acciones rivales.
- Métricas derivadas del board.
- `dropReceive` como default de `raise-block`.
- LLM / puente al CoachAgent.
- Autoría de respuesta rival para los otros 10 escenarios (solo `raise-block`).

## 10. Archivos afectados (previsto)

- `src/board/scenarioBoardConsequence.ts` — nueva función autora + absorción de
  la `longPass`; sin cambios de tipos públicos (reusa `OverlayArrow`).
- `src/board/boardGeometry.ts` — **una línea**: rama `if (arrow.layer ===
  "rival") return true;` al inicio de `layerVisibleForArrow` (Patch visibilidad,
  §4 dec. 6).
- `tests/scenarioBoardConsequence.test.ts` — tests §8.
- (Sin cambios en model, store ni persistencia.)

> **A confirmar en implementación:** si el preview de la overlay pasa por
> `layerVisibleForArrow` o tiene render ghost propio. Si es ghost propio, la rama
> `rival` protege sobre todo el estado **post-accept** (cuando las flechas ya son
> board real y entran al pipeline de capas).
