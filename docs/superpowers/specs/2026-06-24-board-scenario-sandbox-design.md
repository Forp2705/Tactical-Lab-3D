# Board Scenario Sandbox — Design (Slice 1)

> Fecha: 2026-06-24. Estado: diseño aprobado sección por sección, pendiente de review final antes de writing-plans.
> Construye sobre el trabajo P0 de la Pizarra (ya en `main`). No depende de P0.7 (pulido visual, en rama aparte).

## 1. Motivación: el salto de categoría

Hasta P0, la Pizarra era un diagrama estático que el DT llenaba. P0 la convirtió en una **situación legible por máquina**: relaciones ancladas jugador→jugador→zona, acciones semánticas tipadas, zonas tipadas, y factories (`createSemanticArrow`, `createTacticalZone`) que permiten escribir de vuelta en el board. Eso —sin que fuera el objetivo explícito— dejó la escena machine-readable y bidireccional.

El salto: que la pizarra deje de **leer** la escena y pase a **razonar sobre ella**. El DT plantea una situación, elige un ajuste táctico, y RomboIQ responde dibujando la consecuencia sobre la escena concreta, con la reacción del rival expresada como hechos anclados a los tokens dibujados.

### Islas que ya existen (verificadas contra el código, no contra la descripción)

- `src/ai/scenarioSimulator.ts` — `simulateScenario(input): ScenarioSimulation` (línea 200). Función **pura, determinística**, 11 escenarios, salida con `confidence` + `evidenceLevel` + `lineImpact` + `benefitedPlayers`/`exposedPlayers` + `fitFindings`. La ética anti-sobreafirmación está horneada (`computeConfidence`/`computeEvidenceLevel` bajan confianza sin evidencia).
- `src/scout/opponentScout.ts` — `buildOpponentGamePlan(scout, gameModel)` produce plan/attackIt/defendIt/alerts **textuales** (no geométricos). Depende de `OpponentScout`, que suele estar vacío.
- `boardModel.ts` — factories `createSemanticArrow` (575), `createTacticalZone` (597); tokens con `linkedPlayerId` (poblado por `createPlayerToken`, 540).
- `productBoardTypes.ts:204-218` — lectura P0.5: `isInsideZoneRect` + conteo own/rival por zona.

### La grieta central

`ScenarioSimulation` es **100% texto/categórico — cero coordenadas**. No dice dónde va una zona ni dónde el espacio a la espalda. Y el CoachAgent recibe un resumen del *LineupLab* (`currentBoardSummary`, desde `LineupLab3D`/`TeamView`), **no** la escena relacional de la Pizarra. Las piezas existen; nada las conecta a la Pizarra.

## 2. Scope de la Slice 1 (decisiones bloqueadas)

Un escenario end-to-end a través del board real prueba la categoría nueva. Decisiones:

| Decisión | Elección | Razón |
|---|---|---|
| Reacción rival | **Hechos en texto** (panel "Qué entiende RomboIQ"), no tokens animados | Aísla el riesgo de movimiento implausible para una slice futura |
| Motor del dibujo | **Proyección determinística de la salida del simulador** (no LLM) | Cero geometría alucinada; client-side; no necesita puente CoachAgent↔board todavía |
| Trigger | **Selección de escenario de una lista** (no lenguaje natural) | Mata el riesgo NLU |
| Métricas | **`metrics: null`** | `CoachShapeMetrics` lo produce el LineupLab, no el board; derivarlas de tokens parciales sería inventar. El simulador degrada con honestidad |
| Escenario piloto | **`raise-block` ("subir el bloque")** | Consecuencia geométrica la más nítida y autorable (zona alta + hueco detrás de centrales) |
| Persistencia | **Overlay efímera; commit solo por accept explícito** | Separa autoría DT vs IA; protege la pizarra del ruido de IA |
| Provenance post-accept | **Sin campo `origin`** | El accept explícito resuelve la autoría. Auditabilidad futura se decide al tocar el modelo, no se retrofittea |

### "Lógica nueva autorada", dicho derecho

No es "conectar lo que existe". Lo realmente nuevo:

1. **El draw-back es geometría autorada.** Para `raise-block` hay que autorar la consecuencia geométrica y anclarla a los tokens. **No generaliza:** el andamiaje de entrada/selección sirve para los 11, pero cada draw-back se autora por separado. Escalar a 11 ≠ barato.
2. **La reacción rival no tiene fuente en el simulador** (`validationSignals` son "sabés que funcionó si…", no "qué hace el rival"). Se autora para `raise-block`, anclada a la escena.
3. **El puente tokens→`Player`** es real (link opcional; tokens sin vincular no aportan).

## 3. Non-goals (Slice 1)

- LLM / CoachAgent dibujando (queda determinístico).
- Puente board→CoachAgent.
- Reacción rival como movimiento de tokens (queda en texto).
- Lenguaje natural como trigger.
- Métricas derivadas del board (queda `null`).
- Los otros 10 escenarios (solo `raise-block`).
- Campo `origin`/provenance en el schema.
- Cambios en `api/` o server.

## 4. Arquitectura

### 4.1 Módulos nuevos (el peso real)

**`src/board/scenarioBridge.ts` — entrada (puro)**
`(scene, teamPlayers, gameModel, exercises, scenarioId) → { input: ScenarioInput; unlinkedCount: number }`
- Tokens propios `playerToken` con `linkedPlayerId` → lookup en `team.players` (`Player[]` de `@/data`, mismo tipo que `ScenarioInput.players`) → directo, **sin** `collectPayloadPlayers` (que produce `PlanningBoardPlayer`, otro tipo, mapeo lossy).
- `metrics: null`. `objective` ← problema del board. `evidenceText`/`patterns` ← texto del problema si existe.
- `exercises` (requerido por `ScenarioInput`, usado por `matchExercisesForDiagnosis` dentro del simulador) ← catálogo de `@/data`, provisto por el orquestador.
- `unlinkedCount` alimenta la degradación honesta del panel.

**`src/board/scenarioBoardConsequence.ts` — geometría autorada (puro)**
`(simulation: ScenarioSimulation, scene) → ConsequenceOverlay`
- Registry keyed by `scenarioId`; Slice 1 solo `raise-block`.
- **Dueña la detección de orientación** (ver §5.3).
- Resuelve centrales propios y tercio rival de la escena, autora zonas/flechas ancladas a tokens reales, compone hechos rival con nombres reales.
- Degradación honesta: si falta un anclaje (sin centrales, sin orientación clara), lo dice en `notes` en vez de dibujar geometría fantasma.

**Overlay efímera + accept/discard (UI en la Pizarra)**
- Estado en `useBoardActions` (el orquestador existente), **no** estado de componente suelto. Canvas y panel lo leen por el prop-bag establecido.
- Render en `TacticalBoardCanvas` como capa "preview" (estilo ghost/punteado + label "Proyección de RomboIQ").
- Panel "Qué entiende RomboIQ": `readout` del simulador + `rivalFacts` + `confidence`/`evidenceLevel` + botones **Aceptar / Descartar**.

### 4.2 Reusado tal cual (sin tocar)

`simulateScenario` (puro; `analyzePlayerFit` corre adentro, no se invoca aparte) · `createSemanticArrow`/`createTacticalZone` (en accept) · panel "Qué entiende RomboIQ" (se extiende) · `isInsideZoneRect` + conteo own/rival de P0.5 (para el chequeo de exposición) · `team.players`/`gameModel` del store.

### 4.3 Intocable (el boundary que protege la slice)

- CoachAgent / LLM: no se toca. Slice 1 es 100% determinística client-side.
- `BoardScene` persistido: no se muta salvo accept explícito (vía factories existentes).
- Sin cambios de schema en `boardModel` (sin `origin`).
- Sin `api/`, sin server.

## 5. Data flow y contratos

### 5.1 Flujo (orquestado por `useBoardActions`)

```
DT elige "raise-block"
  → useBoardActions.runScenario(scenarioId)
      1. scenarioBridge(...) → { input, unlinkedCount }
      2. simulateScenario(input) → ScenarioSimulation        [puro, existe]
      3. scenarioBoardConsequence(simulation, scene) → ConsequenceOverlay
      4. setConsequenceOverlay(overlay)                       [estado en useBoardActions]
  → Canvas renderiza la capa preview (ghost + "Proyección de RomboIQ")
  → Panel muestra readout + rivalFacts + confidence/evidenceLevel + Aceptar/Descartar
  → Aceptar: commitOverlay() → map 1:1 a factories → board actions existentes (persiste)
  → Descartar: setConsequenceOverlay(null) → board intacto
```

### 5.2 Contrato `ConsequenceOverlay` — geometría commit-ready

Regla: **la overlay carga la geometría final; accept solo materializa.** Lo que se previsualiza es literalmente lo que se commitea. Los `patch` son alias de los tipos exactos de las factories (un solo lugar de verdad para el shape):

```ts
type OverlayZonePatch  = Partial<Omit<BoardZone,  "id" | "semantic" | "x" | "y" | "w" | "h">>;
type OverlayArrowPatch = Partial<Omit<BoardArrow, "id" | "semantic" | "from" | "to">>;

type OverlayZone  = { semantic: BoardZoneSemantic;  x: number; y: number; w: number; h: number; patch?: OverlayZonePatch };
type OverlayArrow = { semantic: BoardArrowSemantic; from: BoardArrowEndpoint; to: BoardArrowEndpoint; patch?: OverlayArrowPatch };

type ConsequenceOverlay = {
  scenarioId: ScenarioId;
  title: string;
  zones:  OverlayZone[];     // inputs literales de createTacticalZone
  arrows: OverlayArrow[];    // inputs literales de createSemanticArrow (endpoints ya anclados a objectIds reales o points)
  rivalFacts: string[];      // compuestos de tokens reales, etiquetados "lectura del modelo"
  readout: {
    expectedBenefit: string;
    mainRisk: string;
    exposedPlayers: string[];
    confidence: "low" | "medium" | "high";
    evidenceLevel: "none" | "weak" | "partial" | "sufficient";
  };
  notes: string[];           // degradación honesta: tokens sin vincular, sin centrales, orientación por default
};
```

`BoardArrowEndpoint` es la unión discriminada existente: `{ kind: "object", objectId }` | `{ kind: "point", point }`.

### Accept = map 1:1 (preview ≡ commit)

```ts
const zones  = overlay.zones.map(z  => createTacticalZone(z.semantic, z.x, z.y, z.w, z.h, z.patch));
const arrows = overlay.arrows.map(a => createSemanticArrow(a.semantic, a.from, a.to, a.patch));
// commit por la board action existente (misma que usa el inspector)
```

Cero recompute. Si la overlay re-derivara geometría en accept, reintroduciría preview≠commit (dos fuentes de verdad).

### 5.3 Orientación detectada — no asumida (horneada en el contrato)

La orientación de cancha es una **convención, no un invariante**: las formaciones ponen el arquero propio en `x:8` y los centrales rivales en `x:80`, pero nada lo fuerza — un DT puede dibujar la jugada espejada. Asumir "+x es hacia adelante" dibujaría el hueco del lado equivocado: el "se siente falso" que mata credibilidad, invisible en el happy path.

`scenarioBoardConsequence` dueña la detección, en tres tiers (sin circularidad, con piso):

```ts
function detectAttackDir(scene): { dir: 1 | -1; note?: string } {
  // 1 = propio ataca hacia +x ; -1 = hacia -x
  // Tier 1 (primario): arquero propio POR ROLE (Arquero/GK/portero). Su x marca el
  //   lado del arco propio → se ataca en contra. (No usar "token más profundo":
  //   "profundo" presupone la dirección que estamos calculando.)
  // Tier 2 (fallback): centroide propio vs rival. Propio detrás → ataca hacia el lado rival.
  // Tier 3 (piso): sin arquero ni rival → dir = 1, note "orientación asumida, sin arquero ni rival".
}
```

Toda la geometría de `raise-block` se computa relativa a `dir`.

### 5.4 Lifecycle de la overlay vs ediciones de escena

La overlay está anclada a `objectId`s reales y computada para este estado de escena (incluida la orientación). **Regla:** cualquier mutación de la escena con overlay pendiente (mover/borrar/agregar token, etc.) → **descarta la overlay** (`setConsequenceOverlay(null)`). El DT re-corre el escenario para recomputar. Es barato y evita commitear una proyección calculada para una escena que ya no existe (preview≠commit).

## 6. `raise-block` — autoría concreta

1. `{ dir, note } = detectAttackDir(scene)`; si hay `note`, va a `notes`.
2. Centrales propios: por `role` (~CB/DFC/central, técnica P0.5) o, si faltan roles, los 2 propios más atrás respecto a `dir`. Sin centrales → no dibuja hueco, lo dice en `notes`.
3. **Zona de presión alta**: rect sobre el tercio de salida rival (relativo a `dir`), semantic `press`. → `OverlayZone`.
4. **Zona de hueco a la espalda**: rect detrás de la línea de centrales hacia el arco propio (entre centrales y arquero, relativo a `dir`), semantic `danger` (o `freeSpace`). → `OverlayZone`.
5. **Chequeo de exposición**: `isInsideZoneRect` cuenta propios dentro del hueco. 0 cobertura → hecho rival fuerte; ≥1 → atenuado.
6. **Hecho rival compuesto** (no enlatado): "tus centrales [Tomás/Diego] suben; detrás quedan {N} coberturas → el rival ataca esa espalda con diagonal larga" — nombres reales + conteo real, etiquetado lectura del modelo (no claim de alta confianza).
7. **Flecha de amenaza** (opcional): semantic `longPass` (la diagonal al hueco) o `run` (el corredor que ataca el espacio) — **no `ballRoute`, que no existe en el enum**. Anclada a un token rival si existe (`{kind:"object",objectId}`), si no a `{kind:"point",point}`. → `OverlayArrow`.

## 7. Degradación honesta (mismo patrón que P0.5)

El panel dice **qué falta**, no muestra vacío:
- Tokens sin `linkedPlayerId` → "Vinculá las fichas al plantel para leer jugadores expuestos." (`unlinkedCount > 0`).
- Sin centrales resolubles → "No pude ubicar los centrales en la escena."
- Orientación por fallback/piso → la `note` correspondiente.
- `confidence`/`evidenceLevel` del simulador se muestran sin inflar (con `metrics: null`, la confianza será baja por diseño).

## 8. Testing (unidades aisladas)

- **`scenarioBridge`**: dado scene+team con tokens vinculados → `ScenarioInput` con los `Player` correctos, `metrics: null`, `unlinkedCount` exacto. Tokens sin link excluidos.
- **`detectAttackDir`**: escena con arquero a la izquierda → `dir:1`; arquero a la derecha (espejada) → `dir:-1`; sin arquero, propio detrás de rival → fallback correcto; sin arquero ni rival → `dir:1` + note.
- **`scenarioBoardConsequence` (raise-block)**: dado `simulation` + escena con centrales conocidos → overlay con zona de hueco anclada del lado correcto según `dir`, conteo de exposición correcto vía `isInsideZoneRect`, y `rivalFacts` que contienen los nombres reales de los centrales. Caso espejado: el hueco cae del lado correcto.
- **accept→commit**: `commitOverlay` produce `BoardArrow`/`BoardZone` reales vía factories, idénticos a los items de la overlay (map 1:1, sin recompute).
- **lifecycle**: mutar la escena con overlay pendiente → overlay descartada.

## 9. Slices futuras (fuera de este spec)

- **Follow-up #1 — `detectAttackDir` cross-check entre tiers (hardening, no nice-to-have).** En el primer board real (smoke en vivo, slice 1) un arquero suelto (GK x=62, centrales x=22) ganó por Tier-1 y devolvió `dir=-1` **en silencio, con confianza, sin note** → presión del lado equivocado. Fix concreto y **no circular**: Tier-1 (arquero por role) vs Tier-2 (centroide propio vs rival). Coinciden → alta confianza. Se contradicen → el arquero es el sospechoso (un solo token); preferí el centroide (basado en masa, robusto al token suelto) y emití una `note` ("el arquero contradice la línea/rival, uso el centroide"). No es circular porque masa-propia-vs-rival no usa "profundidad" (la dirección que se calcula). Un token no debe voltear toda la proyección en silencio. Meta-lección: el spec asumió boards geométricamente coherentes; los reales son messy — el cross-check endurece contra una falla ya observada.
- Autorar los otros 10 escenarios (cada uno, su draw-back).
- Reacción rival dibujada/anclada (token movement) con grounding.
- Puente board→CoachAgent (LLM propone mutaciones validadas).
- Métricas derivadas del board (sube la confianza).
- Provenance (`origin`) si se quiere auditabilidad DT-vs-IA.
