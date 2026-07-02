# PLAN — Entrega B: bridge board->coach sobre estado libre (mc-21 / Ola 2)

Branch: `feat/w2-freestate-bridge` desde `origin/main` (10bcbc4).

Diseno aprobado por el coordinador en `DESIGN-B.md` (checkpoint previo, ver
ese archivo para el detalle de los 4 puntos del brief). Este plan incorpora
las 4 enmiendas de la aprobacion:

1. `src/ai/coachAgentClient.ts` autorizado en scope (home natural del fetch
   wrapper existente).
2. **No es aceptable** shippear el boton con hechos que no llegan al agente
   (seria la caja negra que el producto prohibe). El coordinador define la
   interfaz: `api/coach-agent.ts` reenvia el packet valido como
   `freeStateEvidence` a `runCoachTurn`. mc-17 recibira un follow-up aparte
   para exponer ese parametro en el prompt (renderiza SOLO `factualClaims`
   como hechos contables, misma doctrina defensiva de slice 4). Yo implemento
   TODO ahora escrito contra esa interfaz exacta; mi branch mergea DESPUES
   del branch de mc-17, asi el path nace vivo y honesto.
3. Los ids de los claims deben ser deterministas/estables por contenido (no
   uuids) — se usan como `boardClaimId` para referenciar.
4. `authority: "high"` y `grounded: true` (literal) confirmados como se
   propuso.

## 1. Packet nuevo: `src/board/boardFreeStateEvidencePacket.ts`

Schema (tipo nuevo, sibling de `BoardEvidencePacketSchema`, sin tocarla):

```ts
const FreeStateFactualClaimSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("formation"), side: z.enum(["own","rival"]), formation: z.string().min(1), grounded: z.literal(true) }),
  z.object({ id, kind: z.literal("tokenCount"), side: z.enum(["own","rival"]), count: z.number().int().min(0), grounded: z.literal(true) }),
  z.object({ id, kind: z.literal("objectCount"), objectType: z.enum(["arrow","zone","note"]), semantic: z.string().min(1).optional(), count: z.number().int().min(1), grounded: z.literal(true) }),
  z.object({ id, kind: z.literal("scene"), title: z.string().min(1), index: z.number().int().min(0), totalScenes: z.number().int().min(1), grounded: z.literal(true) }),
  z.object({ id, kind: z.literal("layers"), visible: z.array(z.string()), grounded: z.literal(true) }),
]);

const BoardFreeStateEvidencePacketSchema = z.object({
  source: z.literal("boardFreeState"),
  scope: z.literal("currentScene"),
  boardId: z.string().min(1),
  sceneId: z.string().min(1),
  freeStateEvidence: z.object({
    authority: z.literal("high"),
    factualClaims: z.array(FreeStateFactualClaimSchema),
  }),
}).superRefine(/* unique ids, mismo patron que el packet existente */);
```

IDs deterministas por contenido (enmienda 3): `formation-own`,
`formation-rival`, `token-count-own`, `token-count-rival`,
`object-count-arrow-<semantic>`, `object-count-zone-<semantic>`,
`object-count-note`, `scene-active`, `layers-visible`. Mismo `kind`+`side`/
`objectType`+`semantic` siempre produce el mismo id — no hay aleatoriedad.

`parseIncomingBoardFreeState(raw)`: mismo contrato `absent | ok | malformed`
que `parseIncomingBoardEvidence` (copiado del patron, no reutilizado
directamente porque el tipo es distinto).

`buildBoardFreeStateEvidencePacket(board, scene, teamAFormation, activeLayers)`:
mapper puro. Cuenta objetos por tipo/semantica desde `scene.objects`/
`scene.arrows`/`scene.zones` (solo lo declarado: `arrow.semantic`,
`zone.semantic`), arma los claims, arma el packet. No lee posiciones. No
infiere nada — cada claim es un conteo o un valor declarado tal cual esta en
la escena/workspace.

## 2. Render: `src/board/boardFactPresentation.ts`

Nueva funcion `renderableFreeStateFacts(packet, supportingFacts)`, hermana de
`renderableBoardFacts`, misma doctrina exacta (busca el claim por id en
`freeStateEvidence.factualClaims`, `grounded !== true` nunca se pinta —
aunque hoy siempre es `true`, el guard queda para consistencia de doctrina).
Un `switch` sobre `claim.kind` arma el texto por variante (formacion, conteo
de fichas, conteo de objetos, escena activa, capas visibles).

## 3. UI: `TacticalBoardAiPanel.tsx` + `useBoardActions.ts` / `TacticalBoardView.tsx`

- El boton "Consultar al coach sobre esta escena" sale de adentro del
  `if (consequenceOverlay)` — vive SIEMPRE, en su propia seccion, separado
  del flujo de "Probar un ajuste" (que sigue siendo el camino del escenario
  enlatado, sin tocar).
- Antes de habilitar el boton, se arma el packet
  (`buildBoardFreeStateEvidencePacket`) y se muestra un resumen legible (las
  mismas filas que devuelve `renderableFreeStateFacts` para los claims que el
  usuario va a mandar, ANTES de preguntar — transparencia: "esto es lo que le
  mando al coach").
- `onAskCoachFreeState` en `useBoardActions.ts`: arma el packet, lo valida
  client-side con `BoardFreeStateEvidencePacketSchema.safeParse` (fail-fast,
  nunca manda algo que el propio schema rechazaria), llama a
  `requestBoardFreeStateTurn` (nuevo en `coachAgentClient.ts`, espejo de
  `requestBoardScenarioTurn`), mismo patron de loading/error/answer que el
  flujo de escenario existente (estado honesto, nunca fallback silencioso).

## 4. Server: `api/coach-agent.ts`

Gate additive, mismo patron que el de `boardEvidence`:

```ts
const freeStateResult = parseIncomingBoardFreeState(body.freeStateEvidence);
if (freeStateResult.status === "malformed") {
  sendJson(res, 400, { code: "INVALID_FREE_STATE_EVIDENCE", error: "..." });
  return;
}
const freeStateEvidence = freeStateResult.status === "ok" ? freeStateResult.packet : null;
```

Forwarding a `runCoachTurn` (enmienda 2, interfaz definida por el
coordinador): `runCoachTurn` hoy tipa su argumento como
`Parameters<typeof runCoachTurnCore>[0] & { boardEvidence?: BoardEvidencePacket | null }`
(en `CoachAgent.ts`, prohibido tocar). Todavia NO tiene `freeStateEvidence`
en esa interseccion — eso lo agrega mc-17 en su rama. Para que ESTA rama
type-checkee en soledad contra el `main` actual (sin la rama de mc-17
todavia mergeada) Y quede honestamente escrita contra la interfaz acordada,
el forwarding se hace via un cast explicito y comentado en el propio
`api/coach-agent.ts` (no en `CoachAgent.ts`):

```ts
type RunCoachTurnArgsWithFreeState = Parameters<typeof runCoachTurn>[0] & {
  freeStateEvidence?: BoardFreeStateEvidencePacket | null;
};
const response = await runCoachTurn({
  input, coachContext, collectedEvidence, interviewState, skipInterview,
  boardEvidence,
  freeStateEvidence,
} as RunCoachTurnArgsWithFreeState);
```

Esto compila hoy (el valor extra viaja hasta `runCoachTurn`, que lo ignora
sin tocarlo porque su destructuring actual no lo nombra) y, apenas la rama de
mc-17 agregue `freeStateEvidence` a la interseccion real en `CoachAgent.ts`,
el cast deja de hacer falta ninguna otra cosa: el dato ya viaja con el
nombre/forma exactos. Comentario explicito en el codigo marcando esto como
temporal-pero-funcional, coordinado con mc-17 (no un placeholder muerto).

## 5. Archivos tocados

- `src/board/boardFreeStateEvidencePacket.ts` (nuevo)
- `src/board/boardFactPresentation.ts` (extendido, funcion nueva)
- `src/board/components/TacticalBoardAiPanel.tsx` (boton siempre visible +
  resumen)
- `src/board/useBoardActions.ts` (handler `onAskCoachFreeState`)
- `src/board/TacticalBoardView.tsx` (wiring del handler nuevo)
- `src/ai/coachAgentClient.ts` (`requestBoardFreeStateTurn`)
- `api/coach-agent.ts` (gate additive + forwarding contra la interfaz
  acordada)
- Tests nuevos: `tests/boardFreeStateEvidencePacket.test.ts` (valido /
  malformed / limite / ids deterministas), render, `tests/boardFactPresentation.test.ts`
  (extendido), gate del api.

Nada de `CoachAgent.ts`, `CoachAgentPrompt.ts`, `useAppStore.ts`, memoria
tactica.

## 6. Validacion

```
npm run type-check
npm run build
npm test -- --run
npm test -- --run tests/board*.test.ts
```

En vivo SIN key: crear board, abrir pizarra, click "Consultar al coach sobre
esta escena" sin overlay activo (contract clave de B), confirmar que el
resumen del packet se ve ANTES de preguntar, y que la falta de key produce un
error honesto visible (no un fallback silencioso ni una respuesta inventada).
Repetir con un packet forzado a malformed (via consola) para confirmar 400.

Guard EOL: `git diff --stat` antes de cada commit.
