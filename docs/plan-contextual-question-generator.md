# Plan de implementación — Contextual Question Generator (Modo entrevista táctica)

Estado: diseño aprobado para implementar. **No implementar hasta validar este plan.**

Restricciones operativas:
- No romper el flujo actual del Coach Agent.
- No reescribir la app.
- No tocar post-match reports.
- No tocar video analysis.
- Máximo **una** llamada LLM por turno de entrevista.

---

## 0. Decisiones de diseño que cierran los huecos del spec

### D1 — Una sola llamada LLM por turno
Un "turno" = un round-trip a `/api/coach-agent` = **una** llamada LLM.

- Turno 1 (sin `interviewState`): se hace la llamada de *generación de preguntas*, que también deriva `intent` + `temptingClaims`. Si el input ya es específico y la evidencia recuperada alcanza, el generador devuelve `selectedQuestions: []` + `recommendedResponseMode: "diagnosis"`, y el cliente dispara un segundo turno que diagnostica. Cada turno sigue siendo 1 llamada.
- Turnos siguientes: el cliente reenvía `interviewState` (`intent`, `temptingClaims`, `audit`). El gate "¿alcanza la evidencia?" se calcula **en código** contra los `requiredEvidence` cacheados. Según el gate, el turno hace *o* regenerar preguntas *o* diagnosticar. Nunca las dos.

### D2 — `shortText` → `EvidenceSignal` sin segunda llamada
La respuesta hereda el `evidenceTarget` de la pregunta que la originó (la pregunta ya nace con `evidenceTarget` definido). No se re-clasifica el texto libre.
- Opción elegida (`singleChoice`/`multiChoice`/`yesNo`) → `confidence: "medium"`.
- Texto libre (`shortText`) → `confidence: "weak"`.

### D3 — `wideDefense` NO se agrega
Los problemas por banda se modelan con dominio `defense` o `duels` + `evidenceTarget: "zone"` (valor `wide`). Mantiene el union alineado con la tabla de ejemplos del spec y con el vocabulario táctico existente.

### D4 — `evidenceMap` se reemplaza por un único tipo `EvidenceAudit`
Se elimina la forma mixta (`Map.has()` + `.currentEvidenceCount`). Una sola estructura, derivable y testeable (ver §4).

### D5 — Reuso de retrieval
El retrieval (`retrieveRelevantContext` + knowledge + generated memory + reports) se extrae a un helper compartido `retrieveCoachEvidence(userInput)`. Lo consumen *tanto* el generador de preguntas como el path de diagnóstico. **Cero doble retrieval.**

### D6 — Contrato: unión discriminada, `CoachMatchAdviceSchema` intacto
No se modifica `CoachMatchAdviceSchema`. Se lo envuelve. `hypothesis` y `diagnosis` reutilizan ese schema; la diferencia es el discriminante + el `confidenceCap` aplicado en código. `question` no exige ningún campo de diagnóstico.

---

## 1. Plan archivo por archivo

### Nuevos
| Archivo | Responsabilidad |
|---|---|
| `src/ai/contextualQuestionGenerator.ts` | 1 llamada LLM (classify + claims + draft questions) + post-proceso determinístico (score/diversify/select/cap). LLM inyectado como dependencia para testear. |
| `src/ai/evidenceCollection.ts` | Funciones puras: normalizar respuestas, construir `EvidenceAudit`, mergear evidencia, `capConfidence`. |
| `src/ai/CoachQuestionPrompt.ts` | System prompt **separado** para la llamada de generación de preguntas (no contamina el prompt de diagnóstico). |
| `tests/contextualQuestionGenerator.test.ts` | Scoring, diversify, maxQuestions, wasAlreadyAnswered, selección con LLM mockeado. |
| `tests/evidenceCollection.test.ts` | normalize, audit, capConfidence. |
| `tests/coachResponseSchema.test.ts` | Round-trip de la unión discriminada por `mode`. |

### Modificados
| Archivo | Cambio |
|---|---|
| `src/ai/CoachSchemas.ts` | Agregar `TacticalDomain`, `ContextualQuestion`, `EvidenceAudit`, `TacticalIntent`, `ImpliedClaim`, `CollectedAnswer`, `CoachResponseSchema` (unión). `CoachMatchAdviceSchema` sin cambios. |
| `src/ai/CoachAgent.ts` | Extraer `retrieveCoachEvidence`; refactor `generateCoachResponse` para aceptar evidencia pre-fetcheada; nuevo orquestador `runCoachTurn`. |
| `src/ai/coachResponseParsing.ts` | Agregar `parseCoachResponse` (unión) reutilizando `extractJsonObject`; `parseCoachAdvice` queda igual. |
| `api/coach-agent.ts` | Aceptar `collectedEvidence` + `interviewState`; llamar `runCoachTurn`; devolver la unión. |
| `src/ai/coachAgentClient.ts` | Firma con `options` (collectedEvidence, interviewState); tipo de retorno = unión. |
| `src/state/useAppStore.ts` | Slice `coachInterview` + acciones. |
| `src/state/db.ts` | Migración aditiva: default de `coachInterview` para snapshots viejos. |
| `src/ai/AiView.tsx` | Render por `mode`; controles de respuesta; progreso; botones responder/saltar. |
| `src/app/theme.css` | Estilos `.evidence-*`, `.response-mode-badge`. |
| `src/ai/CoachAgentPrompt.ts` | Sin cambios de comportamiento (el diagnóstico sigue igual). Solo nota: el prompt de preguntas vive aparte (CoachQuestionPrompt.ts). |

---

## 2. Schema discriminado (CoachSchemas.ts — adiciones)

```ts
// ---- Vocabulario táctico (NUEVO en el código) ----
export const TacticalDomainSchema = z.enum([
  "defense", "pressing", "block", "buildUp",
  "defensiveTransition", "offensiveTransition", "attack",
  "setPieces", "duels", "physicalEmotional", "systemLineup",
]); // D3: sin wideDefense
export type TacticalDomain = z.infer<typeof TacticalDomainSchema>;

export const EvidenceTargetSchema = z.enum([
  "ownTeam", "rival", "phase", "playerProfile", "zone",
  "trigger", "frequency", "moment", "matchContext", "cause", "risk",
]);
export type EvidenceTarget = z.infer<typeof EvidenceTargetSchema>;

export const SpecificitySchema = z.enum(["general", "specific", "contradictory"]);
export const RequestTypeSchema = z.enum(["diagnosis", "quickIdea", "generalExplanation", "actionPlan"]);
export const QuestionPurposeSchema = z.enum([
  "classifyProblem", "locateZone", "identifySubject", "confirmTrigger",
  "confirmFrequency", "separateCauseFromSymptom", "assessRisk", "chooseAdjustmentPath",
]);
export const AnswerKindSchema = z.enum(["singleChoice", "multiChoice", "shortText", "yesNo"]);

export const ImpliedClaimSchema = z.object({
  id: z.string(),
  claim: z.string(),
  domain: TacticalDomainSchema,
  subject: z.enum(["own", "rival", "both", "unknown"]),
  riskIfWrong: z.enum(["low", "medium", "high"]),
  requiredEvidence: z.array(EvidenceTargetSchema),
});

export const TacticalIntentSchema = z.object({
  domains: z.array(TacticalDomainSchema).min(1),
  specificity: SpecificitySchema,
  requestType: RequestTypeSchema,
  impliedClaims: z.array(ImpliedClaimSchema).default([]),
});

export const ContextualQuestionSchema = z.object({
  id: z.string(),
  category: TacticalDomainSchema,
  question: z.string().min(1),
  whyItMatters: z.string().min(1),
  informationValue: z.enum(["low", "medium", "high"]),
  tacticalRiskReduced: z.string(),
  expectedImpactOnDiagnosis: z.enum(["low", "medium", "high"]),
  evidenceTarget: EvidenceTargetSchema,
  purpose: QuestionPurposeSchema,
  answerKind: AnswerKindSchema,
  options: z.array(z.string()).optional(),
  blocksClaimIds: z.array(z.string()).default([]),
});
export type ContextualQuestion = z.infer<typeof ContextualQuestionSchema>;

// D4: estructura única de auditoría de evidencia
export const EvidenceAuditSchema = z.object({
  covered: z.array(EvidenceTargetSchema).default([]),
  missing: z.array(z.object({
    target: EvidenceTargetSchema,
    reason: z.string(),
  })).default([]),
  criticalMissingCount: z.number().int().min(0),
  evidenceStrength: z.enum(["none", "weak", "partial", "sufficient"]),
});
export type EvidenceAudit = z.infer<typeof EvidenceAuditSchema>;

// Respuesta del usuario a una pregunta (D2: lleva su propio evidenceTarget)
export const CollectedAnswerSchema = z.object({
  questionId: z.string(),
  evidenceTarget: EvidenceTargetSchema,
  category: TacticalDomainSchema,
  answerKind: AnswerKindSchema,
  rawAnswer: z.string(),
});
export type CollectedAnswer = z.infer<typeof CollectedAnswerSchema>;

// ---- Unión discriminada (D6) ----
const QuestionResponseSchema = z.object({
  mode: z.literal("question"),
  intent: TacticalIntentSchema,
  selectedQuestions: z.array(ContextualQuestionSchema),
  blockedClaims: z.array(ImpliedClaimSchema).default([]),
  evidenceAudit: EvidenceAuditSchema,
  confidenceCap: z.number().min(0).max(1),
  // NO trae tacticalReading / probableCause / mainAdjustment / onFieldInstructions
});

const HypothesisResponseSchema = z.object({
  mode: z.literal("hypothesis"),
  advice: CoachMatchAdviceSchema, // confidence ya capeado en código
  confidenceCap: z.number().min(0).max(1),
  intent: TacticalIntentSchema,
  evidenceAudit: EvidenceAuditSchema,
  followUpQuestions: z.array(ContextualQuestionSchema).default([]),
});

const DiagnosisResponseSchema = z.object({
  mode: z.literal("diagnosis"),
  advice: CoachMatchAdviceSchema,
  intent: TacticalIntentSchema,
  evidenceAudit: EvidenceAuditSchema,
});

export const CoachResponseSchema = z.discriminatedUnion("mode", [
  QuestionResponseSchema, HypothesisResponseSchema, DiagnosisResponseSchema,
]);
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
```

---

## 3. Firma de `contextualQuestionGenerator.ts`

```ts
import type {
  TacticalIntent, ImpliedClaim, ContextualQuestion,
  EvidenceAudit, CollectedAnswer,
} from "./CoachSchemas.js";
import type { RetrievedEvidence } from "./CoachAgent.js"; // shape del evidenceCatalog actual

// LLM inyectado => testeable sin red
export type QuestionLlmFn = (args: {
  systemPrompt: string;
  userPrompt: string;
}) => Promise<string>; // raw text -> validado por Zod adentro

export type GenerateQuestionsInput = {
  userInput: string;
  evidenceCatalog: RetrievedEvidence[];        // D5: retrieval compartido
  collectedEvidence: CollectedAnswer[];
  priorIntent?: TacticalIntent | null;         // turnos >1: evita re-clasificar
  priorClaims?: ImpliedClaim[];
};

export type GenerateQuestionsResult = {
  intent: TacticalIntent;
  temptingClaims: ImpliedClaim[];
  selectedQuestions: ContextualQuestion[];
  blockedClaims: ImpliedClaim[];
  evidenceAudit: EvidenceAudit;
  recommendedResponseMode: "question" | "hypothesis" | "diagnosis";
  confidenceCap: number;
};

export async function generateContextualQuestions(
  input: GenerateQuestionsInput,
  runLlm: QuestionLlmFn,
): Promise<GenerateQuestionsResult>;

// ---- Helpers puros exportados (CÓDIGO, testeables) ----
export function scoreQuestion(
  q: ContextualQuestion, intent: TacticalIntent,
  claims: ImpliedClaim[], collected: CollectedAnswer[],
): number;                                            // reglas +3/+2/+1/-3/-2/-1 del spec
export function diversifyQuestions(
  scored: Array<ContextualQuestion & { score: number }>, max: number,
): ContextualQuestion[];                              // dedup por evidenceTarget + purpose
export function maxQuestionsFor(
  intent: TacticalIntent, audit: EvidenceAudit,
): number;                                            // 0 / 1 / 3 / 5 según spec §6
export function wasAlreadyAnswered(
  q: ContextualQuestion, collected: CollectedAnswer[],
): boolean;                                           // por evidenceTarget+category
export function confidenceCapFor(
  audit: EvidenceAudit, selected: ContextualQuestion[],
): number;
```

Flujo interno de `generateContextualQuestions`:
1. **LLM (1 llamada)** → JSON con `{ intent, temptingClaims, questionCandidates[] }`, validado por un schema interno. Si `priorIntent`/`priorClaims` vienen, el prompt los reusa y solo redacta candidatos nuevos.
2. **Código**: `wasAlreadyAnswered` filtra → `scoreQuestion` → ordenar → `maxQuestionsFor` → `diversifyQuestions` → `confidenceCapFor`.
3. Decide `recommendedResponseMode`: `question` si quedan preguntas y `evidenceStrength==="none"`; `diagnosis` si `audit.criticalMissingCount===0`; si no, `hypothesis`.

---

## 4. Firma de `evidenceCollection.ts`

```ts
import type {
  CollectedAnswer, EvidenceAudit, EvidenceTarget,
  ImpliedClaim, TacticalIntent,
} from "./CoachSchemas.js";
import type { RetrievedEvidence } from "./CoachAgent.js";

export type EvidenceSignal = {
  target: EvidenceTarget;
  value: string;
  source: "userAnswer" | "userInput" | "report" | "memory" | "knowledge" | "video";
  confidence: "low" | "medium" | "high";
};

// D2: el target viene de la pregunta, NO se infiere del texto
export function normalizeCollectedEvidence(answers: CollectedAnswer[]): EvidenceSignal[];

// D4: única fuente de verdad de cobertura
export function buildEvidenceAudit(args: {
  claims: ImpliedClaim[];
  signals: EvidenceSignal[];
  retrieved: RetrievedEvidence[];      // evidencia ya conocida => no se vuelve a preguntar
  intent?: TacticalIntent | null;
}): EvidenceAudit;

export function mergeUserAnswersIntoEvidence(
  prior: EvidenceSignal[], answers: CollectedAnswer[],
): EvidenceSignal[];

// cap duro aplicado en código (el modelo no es confiable para esto)
export function capConfidence(
  rawConfidence: number, audit: EvidenceAudit, skipped: boolean,
): number; // skip => min(raw, 0.55); else => min(raw, confidenceCapFor-derived)
```

`evidenceStrength`: `none` (0 críticos cubiertos) → `weak` (1) → `partial` (≥2, falta ≥1) → `sufficient` (`criticalMissingCount===0`).

---

## 5. Cambios en `CoachAgent.ts`

```ts
// NUEVO: retrieval compartido (extraído del cuerpo actual de generateCoachResponse)
export type RetrievedEvidence = {
  id: string; sourceType: "knowledge"|"memory"|"observation"|"report";
  title: string; excerpt: string; score: number;
};
export async function retrieveCoachEvidence(userInput: string): Promise<{
  evidenceCatalog: RetrievedEvidence[];
  relevantContext; relevantKnowledge; relevantGeneratedMemory;
  relevantReports; recentReports;
}>;

// REFACTOR: acepta evidencia pre-fetcheada (sin re-retrieval). Comportamiento
// de diagnóstico idéntico al actual cuando se la llama sin entrevista.
export async function generateCoachResponse(
  userInput: string,
  coachContext?: unknown,
  prefetched?: Awaited<ReturnType<typeof retrieveCoachEvidence>>,
): Promise<CoachMatchAdvice>;

// NUEVO: orquestador de turno (D1)
export async function runCoachTurn(args: {
  input: string;
  coachContext?: unknown;
  collectedEvidence?: CollectedAnswer[];
  interviewState?: { intent: TacticalIntent; temptingClaims: ImpliedClaim[]; audit: EvidenceAudit } | null;
}): Promise<CoachResponse>;
```

Lógica de `runCoachTurn`:
1. `retrieveCoachEvidence(input)` → **una sola vez**.
2. `signals = normalizeCollectedEvidence(collectedEvidence)`; `audit = buildEvidenceAudit(...)`.
3. Gate determinístico:
   - Si hay `interviewState` y `audit.criticalMissingCount===0` → **diagnosis**: `generateCoachResponse(input, ctx, prefetched)` (1 llamada). `mode:"diagnosis"`.
   - Si el usuario saltó (`skip`) → `generateCoachResponse` + `capConfidence(...,skipped=true)` → `mode:"hypothesis"`.
   - Si no alcanza → `generateContextualQuestions(...)` (1 llamada). Si devuelve 0 preguntas + `recommendedResponseMode:"diagnosis"` → marcar para que el cliente continúe; si no → `mode:"question"`.
4. Nunca se hacen las dos llamadas en el mismo turno.

`generateCoachResponse` mantiene la escalera de modelos, JSON-mode fallback y `attachEvidenceCitations` tal cual.

---

## 6. Cambios en `api/coach-agent.ts`

```ts
const body = await readJsonBody(req);
const input = typeof body.input === "string" ? body.input.trim() : "";
const coachContext = body.coachContext ?? body.shapeContext;
const collectedEvidence = CollectedAnswerSchema.array()
  .safeParse(body.collectedEvidence).data ?? [];
const interviewState = body.interviewState ?? null; // validado dentro de runCoachTurn

if (!input) return badRequest(res, "Input is required");

const { runCoachTurn } = await import("../src/ai/CoachAgent.js");
const response = await runCoachTurn({ input, coachContext, collectedEvidence, interviewState });
sendJson(res, 200, response); // ahora la unión discriminada
```

Manejo de error idéntico (`publicServerError`). Sin cambios en `_utils`.

---

## 7. Cambios en `coachAgentClient.ts`

```ts
import type { CoachResponse, CollectedAnswer, TacticalIntent, ImpliedClaim, EvidenceAudit } from "./CoachSchemas";

export type CoachTurnOptions = {
  collectedEvidence?: CollectedAnswer[];
  interviewState?: { intent: TacticalIntent; temptingClaims: ImpliedClaim[]; audit: EvidenceAudit } | null;
};

export async function requestCoachAgent(
  input: string,
  coachContext?: CoachAgentRuntimeContext | null,
  options?: CoachTurnOptions,
): Promise<CoachResponse> {            // ⚠️ retorno cambia de CoachMatchAdvice a CoachResponse
  const response = await fetch("/api/coach-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, coachContext, ...options }),
  });
  // ...validación de error igual; parse final contra CoachResponseSchema
}
```

Nota de migración: el retorno deja de ser `CoachMatchAdvice` plano. `AiView` se actualiza en el mismo paso (van juntos en el build — es app local, un solo bundle, no hay desincronización posible entre cliente/servidor).

---

## 8. Cambios en `useAppStore.ts`

```ts
// en AppState:
coachInterview: {
  active: boolean;
  intent: TacticalIntent | null;
  temptingClaims: ImpliedClaim[];
  audit: EvidenceAudit | null;
  questions: ContextualQuestion[];
  collectedEvidence: CollectedAnswer[];
  turn: number;
};

// acciones:
startCoachInterview: (result: GenerateQuestionsResult) => void;
recordCoachAnswer: (answer: CollectedAnswer) => void;     // upsert por questionId
applyCoachTurnResult: (response: CoachResponse) => void;  // refresca questions/intent/audit
resetCoachInterview: () => void;                          // al cambiar de prompt o de modo
```

Valor inicial: `{ active:false, intent:null, temptingClaims:[], audit:null, questions:[], collectedEvidence:[], turn:0 }`.

`db.ts`: bump de `version` + en `loadSnapshot`, si falta `coachInterview`, inyectar el default (migración aditiva, no rompe snapshots viejos). La entrevista es efímera: se puede excluir del snapshot persistido si se prefiere no guardarla (recomendado — vive solo en memoria de sesión). Decisión final: **no persistir** `coachInterview`; queda en el store en runtime y se resetea al recargar. Eso evita migración y respeta "no romper el store persistido".

---

## 9. Cambios en `AiView.tsx`

- `runCoachAgent` se vuelve turn-aware:
  ```ts
  const response = await requestCoachAgent(input, coachContext, {
    collectedEvidence: coachInterview.collectedEvidence,
    interviewState: coachInterview.intent
      ? { intent: coachInterview.intent, temptingClaims: coachInterview.temptingClaims, audit: coachInterview.audit! }
      : null,
  });
  applyCoachTurnResult(response);
  if (response.mode === "question" && response.selectedQuestions.length === 0) {
    void runCoachAgent(); // auto-continuar a diagnóstico (1 llamada por turno, 2 turnos)
  }
  ```
- Render por `response.mode`:
  - `question`: badge "Modo entrevista táctica" + `EvidenceProgress` (`audit.evidenceStrength`) + `QuestionCard[]` con `QuickAnswerOptions`/`OptionalFreeText`; botones **Responder y continuar**, **Saltar y recibir hipótesis**.
  - `hypothesis`: render de `advice` + `.response-mode-badge` con warning de confianza capeada (cap visible).
  - `diagnosis`: render actual de `advice` (sin cambios visuales).
- Skip → set flag y re-llamar; server devuelve `hypothesis` con cap 0.55.
- `EvidenceProgress`: `none → "Falta evidencia"`, `weak → "Solo hipótesis"`, `partial → "Lectura preliminar"`, `sufficient → "Evidencia suficiente"`.

`theme.css`: `.evidence-interview`, `.evidence-question-card`, `.evidence-option`, `.evidence-progress`, `.response-mode-badge`.

---

## 10. Tests mínimos

`tests/contextualQuestionGenerator.test.ts` (LLM mockeado):
- `scoreQuestion`: aplica +3 evita inventar, +3 cambia ajuste, +2 sujeto, +2 zona, +1 frecuencia, -3 ya respondida, -2 fuera de dominio, -1 fina para input vago.
- `diversifyQuestions`: descarta cuando target Y purpose ya usados; respeta `max`.
- `maxQuestionsFor`: 5 (vago, 0 evidencia), 3 (specific), 1 (una pieza crítica), 0 (suficiente).
- `wasAlreadyAnswered`: true si `collectedEvidence` cubre `evidenceTarget+category`.
- `generateContextualQuestions` con `runLlm` mock → selección determinística estable.

`tests/evidenceCollection.test.ts`:
- `normalizeCollectedEvidence`: shortText hereda target de la pregunta; confidence weak vs medium (D2).
- `buildEvidenceAudit`: transiciones none→weak→partial→sufficient; `criticalMissingCount` correcto; evidencia recuperada reduce missing.
- `capConfidence`: skip → `min(raw, 0.55)`; normal → `min(raw, cap)`.

`tests/coachResponseSchema.test.ts`:
- Parse OK de cada `mode`.
- `mode:"question"` valida **sin** campos de diagnóstico.
- `mode:"diagnosis"`/`"hypothesis"` exigen `advice` válido.

No se tocan `tests/postMatch*.ts`, `coords`, `matchEngine`, `microcycleAlerts`.

Verificación: `npm run type-check && npm run build && npm test -- --run tests/contextualQuestionGenerator.test.ts tests/evidenceCollection.test.ts tests/coachResponseSchema.test.ts`.

---

## 11. Orden de implementación seguro

1. **Schemas** (`CoachSchemas.ts`): tipos + unión. Sin cambio de comportamiento. `type-check`.
2. **`evidenceCollection.ts`** (puro) + `evidenceCollection.test.ts`.
3. **`CoachQuestionPrompt.ts`** + **`contextualQuestionGenerator.ts`** con `runLlm` inyectado + test (LLM mock). Aislado, sin tocar el agente.
4. **`coachResponseParsing.ts`**: `parseCoachResponse` (reusa `extractJsonObject`). + `coachResponseSchema.test.ts`.
5. **`CoachAgent.ts`**: extraer `retrieveCoachEvidence`, refactor `generateCoachResponse(prefetched)`, agregar `runCoachTurn`. En este punto el diagnóstico clásico sigue intacto (llamando `runCoachTurn` sin `collectedEvidence` con input específico → mismo resultado de hoy). `type-check && build`.
6. **`api/coach-agent.ts`** + **`coachAgentClient.ts`**: aceptar/enviar `collectedEvidence`+`interviewState`, retorno unión. Van juntos.
7. **`useAppStore.ts`**: slice `coachInterview` + acciones (sin persistir).
8. **`AiView.tsx`** + **`theme.css`**: UI de entrevista.
9. **Verificación final**: `type-check`, `build`, los 3 tests nuevos, y un smoke manual de los 3 ejemplos del spec (input vago → 3 preguntas; responder → hipótesis; completar → diagnóstico).

Cada paso 1–5 deja la app compilando y el flujo actual funcionando; el cambio de contrato (6) es el único punto donde cliente y servidor cambian a la vez, y ocurre en un solo bundle.

---

## Riesgos residuales a vigilar
- **Calidad de `inferTemptingClaims`**: depende del prompt de `CoachQuestionPrompt.ts`. Es el punto que más itera. Mantener los Ejemplos 1–7 del spec como few-shot.
- **Latencia turno 1 con input específico**: puede costar 2 turnos (preguntas vacías → diagnóstico). Aceptable; el usuario ve un solo spinner por el auto-continue.
- **Modelo `:free` por defecto**: la llamada de preguntas usa la misma escalera/JSON-mode fallback que el diagnóstico; conviene un schema de salida chico para que el modelo free no se desarme.
