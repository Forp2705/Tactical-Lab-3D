import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CoachInterviewState,
  CoachMatchAdvice,
  CollectedAnswer,
  ContextualQuestion,
  ImpliedClaim,
  TacticalIntent,
} from "../src/ai/CoachSchemas";

const mockState = vi.hoisted(() => ({
  advice: null as CoachMatchAdvice | null,
  questionDraft: null as {
    intent: TacticalIntent;
    temptingClaims: ImpliedClaim[];
    questionCandidates: ContextualQuestion[];
  } | null,
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async (args: { messages: Array<{ content: string }> }) => {
          const systemPrompt = args.messages[0]?.content ?? "";
          const payload = systemPrompt.includes("generador de preguntas")
            ? mockState.questionDraft
            : mockState.advice;
          return {
            choices: [{ message: { content: JSON.stringify(payload) } }],
          };
        },
      },
    };
  },
}));

const defenseIntent: TacticalIntent = {
  domains: ["defense"],
  specificity: "specific",
  requestType: "diagnosis",
  impliedClaims: [],
};

const defenseClaim: ImpliedClaim = {
  id: "claim_defense_cause",
  claim: "La causa defensiva esta confirmada.",
  domain: "defense",
  subject: "own",
  riskIfWrong: "high",
  requiredEvidence: ["cause", "zone", "ownTeam"],
};

describe("runCoachTurn", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    mockState.advice = advice();
    mockState.questionDraft = {
      intent: defenseIntent,
      temptingClaims: [defenseClaim],
      questionCandidates: [],
    };
  });

  it("devuelve preguntas cuando el diagnostico inicial no tiene evidencia", async () => {
    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Nos defienden facil por dentro",
      coachContext: emptyCoachContext(),
    });

    expect(response.mode).toBe("question");
    expect(response.mode === "question" ? response.selectedQuestions.length : 0)
      .toBeGreaterThan(0);
    expect(response.evidenceAudit.evidenceStrength).toBe("none");
  });

  it("devuelve hipotesis cuando no hay preguntas visibles para mostrar", async () => {
    mockState.questionDraft = {
      intent: {
        domains: ["pressing"],
        specificity: "general",
        requestType: "generalExplanation",
        impliedClaims: [],
      },
      temptingClaims: [],
      questionCandidates: [],
    };
    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Explicame como funciona la presion alta",
      coachContext: emptyCoachContext(),
    });

    expect(response.mode).toBe("hypothesis");
    expect(response.mode === "hypothesis" ? response.followUpQuestions : [])
      .toEqual([]);
    expect(response.mode === "hypothesis" ? response.advice.reflection.confidence : 1)
      .toBeLessThanOrEqual(0.55);
  });

  it("devuelve hipotesis capada cuando el staff salta la entrevista", async () => {
    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Nos cuesta defender centros",
      coachContext: emptyCoachContext(),
      skipInterview: true,
    });

    expect(response.mode).toBe("hypothesis");
    expect(response.mode === "hypothesis" ? response.advice.reflection.confidence : 1)
      .toBeLessThanOrEqual(0.55);
  });

  it("devuelve hipotesis con evidencia parcial", async () => {
    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Nos parten entre lineas",
      coachContext: emptyCoachContext(),
      interviewState: interviewState(),
      collectedEvidence: [
        collected("q_def_zone", "zone", "Por dentro"),
      ],
    });

    expect(response.mode).toBe("hypothesis");
    expect(response.evidenceAudit.evidenceStrength).toBe("partial");
  });

  it("degrada a hipotesis si hay evidencia suficiente pero no hay citas validas", async () => {
    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Nos parten entre lineas",
      coachContext: emptyCoachContext(),
      interviewState: interviewState(),
      collectedEvidence: [
        collected("q_cause", "cause", "El volante salta y la defensa no achica"),
        collected("q_zone", "zone", "Carril central"),
        collected("q_own", "ownTeam", "Es un problema propio de distancias"),
      ],
    });

    expect(response.mode).toBe("hypothesis");
    expect(response.evidenceAudit.evidenceStrength).toBe("sufficient");
    expect(response.mode === "hypothesis" ? response.advice.evidenceCitations : [])
      .toHaveLength(0);
    expect(
      response.mode === "hypothesis"
        ? response.advice.reflection.mainUncertainty
        : "",
    ).toContain("no hay citas validas");
  });

  it("degrada a hipotesis si la lectura se va de fase aunque tenga una cita", async () => {
    mockState.advice = advice({
      tacticalReading: "El equipo pierde marcas en centros laterales.",
      probableCause: "Los centrales no protegen el segundo palo.",
      mainAdjustment: "Cerrar area y atacar mejor la trayectoria del centro.",
      wednesdayTest: "Defensa de centros laterales y marcas en area.",
      saturdayFocus: "Proteger segundo palo y rechace.",
      evidenceCitations: [
        {
          sourceType: "report",
          sourceId: "RP-1",
          title: "Reporte reciente",
          excerpt: "El problema aparece en centros laterales al area.",
          relevance: 0.84,
          evidenceTargets: ["zone", "trigger"],
        },
      ],
    });

    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Nos cuesta salir limpio con el 5 cuando recibe de espaldas",
      coachContext: emptyCoachContext(),
      interviewState: interviewState(),
      collectedEvidence: [
        collected("q_cause", "cause", "El 5 recibe de espaldas y no encuentra apoyo"),
        collected("q_zone", "zone", "Carril central"),
        collected("q_own", "ownTeam", "Es un problema propio de salida"),
      ],
    });

    expect(response.mode).toBe("hypothesis");
    expect(
      response.mode === "hypothesis"
        ? response.advice.reflection.mainUncertainty
        : "",
    ).toContain("derivando de fase");
  });

  it("mantiene hipotesis si la salida se apoya solo en memoria historica", async () => {
    mockState.advice = advice({
      evidenceCitations: [
        {
          sourceType: "memory",
          sourceId: "MEM-1",
          title: "Memoria estable",
          excerpt: "El equipo suele quedar largo entre lineas.",
          relevance: 0.76,
          evidenceTargets: ["frequency"],
        },
      ],
    });

    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "Nos quedan metros entre lineas tras perdida",
      coachContext: emptyCoachContext(),
      interviewState: interviewState(),
      collectedEvidence: [
        collected("q_cause", "cause", "El medio salta antes de que achique la defensa"),
        collected("q_zone", "zone", "Carril central"),
        collected("q_own", "ownTeam", "Es un problema propio de distancias"),
      ],
    });

    expect(response.mode).toBe("hypothesis");
    expect(
      response.mode === "hypothesis"
        ? response.advice.reflection.mainUncertainty
        : "",
    ).toContain("no hay citas validas");
  });

  it("puede cerrar diagnostico cuando hay evidencia actual manual valida y citada", async () => {
    mockState.advice = advice({
      tacticalReading: "En salida el 9 queda lejos del bloque y la progresion arranca sin apoyo frontal.",
      probableCause: "El 9 inicia demasiado alto y no da una linea de apoyo corta en salida.",
      mainAdjustment: "Acercar el 9 a la salida para conectar primer pase, apoyo y tercer hombre.",
      wednesdayTest: "Tarea de salida con 9 apoyando corto antes de atacar profundidad.",
      saturdayFocus: "Revisar si el 9 vuelve a quedar aislado durante la salida.",
      reflection: {
        mainUncertainty: "Falta ver si se repite en mas partidos.",
        missingInformation: "Falta frecuencia.",
        alternativeInterpretation: "Puede ser un problema de tiempos, no solo de distancia.",
        confidence: 0.66,
      },
      evidenceCitations: [
        {
          sourceType: "observation",
          sourceId: "manual-observation-1",
          title: "Observacion manual del staff",
          excerpt: "El 9 queda lejos del bloque.",
          relevance: 0.81,
          evidenceTargets: ["cause", "zone"],
        },
      ],
    });

    const { runCoachTurn } = await import("../src/ai/CoachAgent");

    const response = await runCoachTurn({
      input: "El 9 queda lejos del bloque cuando salimos",
      coachContext: {
        ...emptyCoachContext(),
        manualObservations: [
          {
            id: "manual-observation-1",
            text: "En salida el 9 queda lejos del bloque y no ofrece apoyo corto.",
            createdAt: "2026-06-05T12:00:00.000Z",
            source: "home",
          },
        ],
      },
      interviewState: interviewState(),
      collectedEvidence: [
        collected("q_cause", "cause", "El 9 no tiene apoyo cercano"),
        collected("q_zone", "zone", "Carril central"),
        collected("q_own", "ownTeam", "Es un problema propio de distancias"),
      ],
    });

    expect(response.mode).toBe("diagnosis");
  });
});

function emptyCoachContext() {
  return {
    availableSquad: [],
    unavailableSquad: [],
  };
}

function interviewState(): CoachInterviewState {
  return {
    intent: defenseIntent,
    temptingClaims: [defenseClaim],
    audit: {
      covered: [],
      missing: [
        { target: "cause", reason: "Falta evidencia para sostener una causa probable." },
        { target: "zone", reason: "Falta ubicar la zona donde aparece el problema." },
        { target: "ownTeam", reason: "Falta confirmar si el problema es del equipo propio." },
      ],
      criticalMissingCount: 3,
      evidenceStrength: "none",
    },
  };
}

function collected(
  questionId: string,
  evidenceTarget: CollectedAnswer["evidenceTarget"],
  rawAnswer: string,
): CollectedAnswer {
  return {
    questionId,
    evidenceTarget,
    category: "defense",
    answerKind: "singleChoice",
    rawAnswer,
  };
}

function advice(patch: Partial<CoachMatchAdvice> = {}): CoachMatchAdvice {
  return {
    tacticalReading: "El equipo queda largo entre volantes y defensores.",
    problemBreakdown: {
      zone: "Carril central",
      moment: "Tras perdida",
      trigger: "Pase vertical rival",
      ownVsRival: "Falla propia de distancia entre lineas",
    },
    probableCause: "El medio salta sin que la defensa achique.",
    mainAdjustment: "Cerrar el bloque antes de presionar hacia delante.",
    alternativeAdjustments: [
      {
        adjustment: "Bloque medio con gatillo de pase atras.",
        whenToUse: "Si el rival sale limpio bajo presion.",
        tradeoff: "Cede metros iniciales.",
      },
      {
        adjustment: "Presion alta por ventanas cortas.",
        whenToUse: "Si el rival tiene centrales imprecisos.",
        tradeoff: "Expone espalda si el salto llega tarde.",
      },
    ],
    onFieldInstructions: ["Achicar antes de saltar."],
    wednesdayTest: "Tarea de perdida y reaccion.",
    saturdayFocus: "No partirse tras perdida.",
    adjustmentRisks: ["Quedar pasivos."],
    successSignals: ["Menos recepciones entre lineas."],
    reflection: {
      mainUncertainty: "Faltan clips.",
      missingInformation: "Falta zona exacta.",
      alternativeInterpretation: "Puede ser cansancio.",
      confidence: 0.7,
    },
    linkedExercises: [],
    actions: [],
    evidenceCitations: [],
    modelContrast: {
      aligned: [],
      contradictions: [],
      insufficientEvidence: [],
    },
    playerFitWarnings: [],
    ...patch,
  };
}
