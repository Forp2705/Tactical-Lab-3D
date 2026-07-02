# DESIGN — Entrega B: bridge board→coach sobre estado libre (mc-21 w2)

Checkpoint de diseno obligatorio del brief (seccion 2). No se escribe codigo
de B hasta el OK del coordinador sobre este documento.

## 1. Shape exacta del packet propuesto

Nuevo archivo `src/board/boardFreeStateEvidencePacket.ts`.

```ts
type FreeStateFactualClaim =
  | { id: string; kind: "formation"; side: "own" | "rival"; formation: string; grounded: true }
  | { id: string; kind: "tokenCount"; side: "own" | "rival"; count: number; grounded: true }
  | { id: string; kind: "objectCount"; objectType: "arrow" | "zone" | "note"; semantic?: string; count: number; grounded: true }
  | { id: string; kind: "scene"; title: string; index: number; totalScenes: number; grounded: true }
  | { id: string; kind: "layers"; visible: string[]; grounded: true };

type BoardFreeStateEvidencePacket = {
  source: "boardFreeState";
  scope: "currentScene";
  boardId: string;
  sceneId: string;
  freeStateEvidence: {
    authority: "high";
    factualClaims: FreeStateFactualClaim[];
  };
};
```

Notas:

- `grounded` es siempre `true` en todas las variantes: son conteos/valores
  declarados directamente desde la escena/workspace, no inferencia. Se deja
  como campo explicito (en vez de omitirlo) para que el render reuse la MISMA
  doctrina defensiva ("ungrounded nunca se pinta") de forma identica al
  packet de escenario, aunque hoy nunca dispare.
- `objectCount.semantic`: el valor declarado del enum `BoardArrowSemantic` /
  `BoardZoneSemantic` (lo que el usuario eligio en el tool rail / inspector),
  nunca texto libre. Las notas no tienen subtipo -> `semantic` se omite para
  `objectType: "note"`.
- **Nada de posiciones/coordenadas en esta primera version.** El brief las
  deja opcionales ("si incluis coordenadas..."); las dejo afuera para
  minimizar superficie de la v1. Se pueden agregar despues, rotuladas como
  crudas, si hace falta.
- **Nada de metricas tacticas inferidas** (no hay "superioridad", "bloque
  alto", etc. — eso es exactamente lo que el brief prohibe para este packet).

## 2. Extiende `BoardEvidencePacket` o tipo nuevo

**Tipo nuevo**, schema hermano. NO se toca `BoardEvidencePacketSchema`,
`boardFactPresentation.ts` ni el gate actual del api.

Razon: `BoardEvidencePacketSchema` usa `source`/`scope` como `z.literal` fijo
y esta envuelto en `.superRefine()` (ZodEffects) — no compone limpio dentro
de un `z.discriminatedUnion` sin tocar codigo ya endurecido/testeado del
firewall slice 4. Un tipo hermano logra additive real (cero riesgo sobre lo
existente) a costa de un poco de duplicacion de forma, aceptable por ser
chica.

## 3. Archivos que se tocan

- `src/board/boardFreeStateEvidencePacket.ts` (nuevo): schema Zod,
  `parseIncomingBoardFreeState` (mismo contrato absent/ok/malformed que
  `parseIncomingBoardEvidence`), builder puro
  `buildBoardFreeStateEvidencePacket(scene, board, teamAFormation, activeLayers)`.
- `src/board/boardFactPresentation.ts`: funcion nueva `renderableFreeStateFacts`,
  misma doctrina "ungrounded -> no numero", hermana de `renderableBoardFacts`
  (la existente no se modifica).
- `src/board/components/TacticalBoardAiPanel.tsx`: boton "Consultar al coach
  sobre esta escena" SIEMPRE visible (sale de adentro del `if (consequenceOverlay)`),
  muestra el resumen del packet (que se manda).
- `src/board/useBoardActions.ts` + `src/board/TacticalBoardView.tsx`: handler
  nuevo `onAskCoachFreeState` (build + valida + POST).
- `api/coach-agent.ts`: gate additive, parsea `body.freeStateEvidence` con la
  misma doctrina absent/ok/malformed->400. Ver punto de coordinacion abajo.
- `src/ai/coachAgentClient.ts`: funcion nueva `requestBoardFreeStateTurn`,
  espejo de `requestBoardScenarioTurn`. **Este archivo no esta en la lista
  explicita de scope del brief** (es el wrapper de fetch ya existente para el
  otro packet) — lo marco por si el coordinador prefiere que lo evite.
- Tests nuevos: packet valido / malformed / valores limite, render, gate del
  api.

### Punto de coordinacion (limite parcial de este incremento)

`runCoachTurn` vive en `CoachAgent.ts` (prohibido tocar) y hoy NO tiene un
parametro `freeStateEvidence` en su firma. Puedo validar el packet en el
server (malformed -> 400) pero no puedo reenviarselo a `runCoachTurn` sin
tocar `CoachAgent.ts`.

**Propuesta**: en este incremento el server valida y responde 400 en
malformed, pero el packet valido todavia NO se reenvia al agente — la
respuesta del coach no va a estar groundeada en estos hechos hasta que mc-17
exponga el parametro nuevo en su prompt/firma. La UI y el firewall quedan
completos y listos; el ultimo cable hacia el agente queda pendiente de
coordinar con mc-17. Esto coincide con la nota de validacion del brief ("sin
key el agente no responde, el flujo hasta el error visible es el smoke").

**Necesito confirmacion**: ¿es aceptable, o preferis que coordine con mc-17
antes de tocar siquiera el gate del api?

## 4. Como renderiza la respuesta

Reusa el PATRON render-from-structure (misma doctrina: solo se pinta lo que
esta en `factualClaims`, lo no groundeado nunca se pinta) via la funcion
nueva y hermana `renderableFreeStateFacts` — no la funcion literal existente,
porque el tipo de packet es distinto por la decision del punto 2.
`CoachBoardClaimReference.boardClaimId` (generico, ya existente en
`CoachSchemas.ts`) no necesita cambios: sirve igual para ambos tipos de
packet.
