import { describe, expect, it } from "vitest";
import {
  applyBoardFactFirewall,
  assessCoachAdviceTrust,
  guardCoachAdvice,
} from "../src/ai/coachOutputGuard";
import {
  CoachResponseSchema,
  type CoachBoardClaimReference,
  type CoachMatchAdvice,
} from "../src/ai/CoachSchemas";
import { diag, hyp, packet } from "./fixtures/coachBridgeFixtures";

describe("coachOutputGuard", () => {
  it("capea confianza si no hay citas validas", () => {
    const guarded = guardCoachAdvice(advice(), {
      userInput: "Nos cuesta salir limpio",
      evidenceCatalog: [],
    });

    expect(guarded.reflection.confidence).toBeLessThanOrEqual(0.45);
    expect(guarded.reflection.mainUncertainty).toContain("no hay citas validas");
  });

  it("capea confianza si la salida deriva de fase", () => {
    const guarded = guardCoachAdvice(
      advice({
        tacticalReading: "El equipo debe defender centros laterales.",
        probableCause: "Falta marca en el area.",
        mainAdjustment: "Cerrar segundo palo.",
        wednesdayTest: "Defensa de centros y marcas en area.",
        saturdayFocus: "Proteger segundo palo.",
        evidenceCitations: [
          {
            sourceType: "knowledge",
            sourceId: "KN-1",
            title: "Salida interior",
            excerpt: "Apoyos del pivote bajo presion.",
            relevance: 0.8,
            evidenceTargets: [],
          },
        ],
      }),
      {
        userInput: "Al 5 lo aprietan cuando recibe de espaldas",
        evidenceCatalog: [
          {
            id: "KN-1",
            sourceType: "knowledge",
          },
        ],
      },
    );

    expect(guarded.reflection.confidence).toBeLessThanOrEqual(0.55);
    expect(guarded.reflection.mainUncertainty).toContain("derivando de fase");
  });

  it("capea afirmaciones fuertes cuando solo hay conocimiento generico", () => {
    const guarded = guardCoachAdvice(
      advice({
        reflection: {
          mainUncertainty: "",
          missingInformation: "Falta evidencia actual.",
          alternativeInterpretation: "Puede ser solo una pauta general.",
          confidence: 0.82,
        },
        evidenceCitations: [
          {
            sourceType: "knowledge",
            sourceId: "KN-1",
            title: "Salida interior",
            excerpt: "Apoyos del pivote bajo presion.",
            relevance: 0.8,
            evidenceTargets: [],
          },
        ],
      }),
      {
        userInput: "Nos cuesta salir limpio por el pivote",
        evidenceCatalog: [
          {
            id: "KN-1",
            sourceType: "knowledge",
          },
        ],
      },
    );

    expect(guarded.reflection.confidence).toBeLessThanOrEqual(0.5);
    expect(guarded.reflection.mainUncertainty).toContain("memoria o principios tacticos");
  });

  it("marca downgrade a hipotesis si no hay citas validas", () => {
    const assessment = assessCoachAdviceTrust(advice(), {
      userInput: "Nos cuesta salir limpio",
      evidenceCatalog: [],
    });

    expect(assessment.requiresHypothesisMode).toBe(true);
    expect(assessment.hasCitation).toBe(false);
    expect(assessment.confidenceCap).toBeLessThanOrEqual(0.45);
  });

  it("marca downgrade a hipotesis cuando deriva de fase", () => {
    const assessment = assessCoachAdviceTrust(
      advice({
        tacticalReading: "El equipo debe defender centros laterales.",
        probableCause: "Falta marca en el area.",
        mainAdjustment: "Cerrar segundo palo.",
        wednesdayTest: "Defensa de centros y marcas en area.",
        saturdayFocus: "Proteger segundo palo.",
        evidenceCitations: [
          {
            sourceType: "report",
            sourceId: "RP-1",
            title: "Reporte rival",
            excerpt: "Problemas por dentro en salida.",
            relevance: 0.8,
            evidenceTargets: [],
          },
        ],
      }),
      {
        userInput: "Al 5 lo aprietan cuando recibe de espaldas",
        evidenceCatalog: [{ id: "RP-1", sourceType: "report" }],
      },
    );

    expect(assessment.missingPrimaryDomain).toBe(true);
    expect(assessment.requiresHypothesisMode).toBe(true);
  });

  it("mantiene diagnostico posible cuando hay evidencia del caso y no deriva de fase", () => {
    const assessment = assessCoachAdviceTrust(
      advice({
        tacticalReading:
          "El pivote recibe de espaldas y pierde el primer apoyo por dentro.",
        probableCause: "Falta un tercer hombre cercano en salida.",
        mainAdjustment: "Acercar apoyo interior antes del primer pase.",
        wednesdayTest: "Rondo de salida con tercer hombre.",
        saturdayFocus: "Sostener salida interior ante presion.",
        evidenceCitations: [
          {
            sourceType: "video",
            sourceId: "VID-1",
            title: "Clip 14: salida interior",
            excerpt: "El 5 recibe de espaldas y no encuentra apoyo.",
            relevance: 0.9,
            evidenceTargets: ["cause", "trigger"],
          },
        ],
      }),
      {
        userInput: "Nos cuesta salir limpio con el 5 de espaldas",
        evidenceCatalog: [{ id: "VID-1", sourceType: "video" }],
      },
    );

    expect(assessment.requiresHypothesisMode).toBe(false);
    expect(assessment.hasCaseEvidence).toBe(true);
    expect(assessment.currentEvidenceCount).toBe(1);
  });

  it("degrada a hipotesis cuando la evidencia citada es solo historica", () => {
    const assessment = assessCoachAdviceTrust(
      advice({
        evidenceCitations: [
          {
            sourceType: "memory",
            sourceId: "MEM-1",
            title: "Memoria estable",
            excerpt: "El equipo suele quedar largo tras perdida.",
            relevance: 0.74,
            evidenceTargets: ["frequency"],
          },
        ],
      }),
      {
        userInput: "Nos quedan metros entre lineas tras perdida",
        evidenceCatalog: [{ id: "MEM-1", sourceType: "memory" }],
      },
    );

    expect(assessment.requiresHypothesisMode).toBe(true);
    expect(assessment.currentEvidenceCount).toBe(0);
    expect(assessment.reliesMostlyOnMemoryOrPrinciples).toBe(true);
    expect(assessment.confidenceCap).toBeLessThanOrEqual(0.5);
  });

  it("acepta observacion manual actual como evidencia valida pero no la confunde con certeza alta", () => {
    const assessment = assessCoachAdviceTrust(
      advice({
        tacticalReading: "En salida el 9 queda lejos del bloque y no ofrece apoyo cercano.",
        probableCause: "La salida arranca sin una distancia corta entre el 9 y los interiores.",
        mainAdjustment: "Acercar el 9 a la salida para crear apoyo frontal antes del primer pase.",
        wednesdayTest: "Tarea de salida con 9 apoyando corto y tercer hombre.",
        saturdayFocus: "Sostener un 9 mas conectado durante la salida.",
        reflection: {
          mainUncertainty: "Falta repetirlo en partido.",
          missingInformation: "Falta frecuencia.",
          alternativeInterpretation: "Puede ser una recepcion aislada.",
          confidence: 0.66,
        },
        evidenceCitations: [
          {
            sourceType: "observation",
            sourceId: "manual-observation-1",
            title: "Observacion manual del staff",
            excerpt: "El 9 queda lejos del bloque en salida.",
            relevance: 0.77,
            evidenceTargets: ["zone", "cause"],
          },
        ],
      }),
      {
        userInput: "El 9 queda lejos en salida",
        evidenceCatalog: [{ id: "manual-observation-1", sourceType: "observation" }],
      },
    );

    expect(assessment.requiresHypothesisMode).toBe(false);
    expect(assessment.currentEvidenceCount).toBe(1);
    expect(assessment.confidenceCap).toBeGreaterThan(0.6);
  });
});

describe("applyBoardFactFirewall (board fact firewall)", () => {
  function adviceOf(response: { advice?: CoachMatchAdvice }): CoachMatchAdvice {
    if (!response.advice) throw new Error("expected advice-bearing response");
    return response.advice;
  }

  it("1. keeps a valid supportingFact with matching partial copiedValues; no downgrade, empty audit", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { delta: 1 } },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    expect(out.audit).toEqual([]);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts).toHaveLength(1);
    expect(advice.supportingFacts[0].copiedValues).toEqual({ delta: 1 });
    expect(advice.reflection.confidence).toBe(0.6);
    if (out.response.mode === "hypothesis") {
      expect(out.response.confidenceCap).toBe(0.7);
    }
  });

  it("2. supportingFact unknown id -> strip + downgrade, audit unknown-id, invalidatedSupport true", () => {
    const out = applyBoardFactFirewall(
      hyp([{ boardClaimId: "no-existe", use: "supportingFact", copiedValues: { delta: 1 } }]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit).toEqual([
      { boardClaimId: "no-existe", use: "supportingFact", reason: "unknown-id", invalidatedSupport: true },
    ]);
    expect(adviceOf(out.response as { advice: CoachMatchAdvice }).supportingFacts).toHaveLength(0);
  });

  it("3. supportingFact missing copiedValues -> strip + downgrade, audit missing-copied-values", () => {
    const out = applyBoardFactFirewall(
      hyp([{ boardClaimId: "presion-zona-3", use: "supportingFact" }]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("missing-copied-values");
    expect(out.audit[0].invalidatedSupport).toBe(true);
    expect(adviceOf(out.response as { advice: CoachMatchAdvice }).supportingFacts).toHaveLength(0);
  });

  it("4. supportingFact value-mismatch -> strip + downgrade, audit value-mismatch", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { delta: 9 } },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("value-mismatch");
    expect(out.audit[0].invalidatedSupport).toBe(true);
  });

  it("5. supportingFact field-incompatible (covering on zone-count) -> strip + downgrade, audit field-incompatible", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { covering: 1 } },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("field-incompatible");
    expect(out.audit[0].invalidatedSupport).toBe(true);
  });

  it("6. supportingFact on grounded:false claim -> strip + downgrade, audit ungrounded-support", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "zona-ciega", use: "supportingFact", copiedValues: { delta: -1 } },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("ungrounded-support");
    expect(out.audit[0].invalidatedSupport).toBe(true);
  });

  it("7. empty factualClaims + supportingFact ref -> strip + downgrade, audit unknown-id", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { delta: 1 } },
      ]),
      packet({ factualClaims: [] }),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("unknown-id");
    expect(out.audit[0].invalidatedSupport).toBe(true);
  });

  it("8. limitation referencing grounded:false claim, no values -> KEPT, no downgrade, empty audit", () => {
    const out = applyBoardFactFirewall(
      hyp([{ boardClaimId: "zona-ciega", use: "limitation" }]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    expect(out.audit).toEqual([]);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts).toHaveLength(1);
    expect(advice.supportingFacts[0].boardClaimId).toBe("zona-ciega");
  });

  it("9. limitation WITH copiedValues -> ref kept but copiedValues stripped, audit ignored-values-on-limitation, no downgrade", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "zona-ciega", use: "limitation", copiedValues: { delta: -1 } },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    expect(out.audit).toEqual([
      {
        boardClaimId: "zona-ciega",
        use: "limitation",
        reason: "ignored-values-on-limitation",
        invalidatedSupport: false,
      },
    ]);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts).toHaveLength(1);
    expect(advice.supportingFacts[0].copiedValues).toBeUndefined();
  });

  it("10. questionTrigger with value-mismatch -> stripped, audit value-mismatch, no downgrade", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "presion-zona-3", use: "questionTrigger", copiedValues: { own: 99 } },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    expect(out.audit[0].reason).toBe("value-mismatch");
    expect(out.audit[0].invalidatedSupport).toBe(false);
    expect(adviceOf(out.response as { advice: CoachMatchAdvice }).supportingFacts).toHaveLength(0);
  });

  it("11a. downgrade lowers BOTH reflection.confidence and confidenceCap on a hypothesis", () => {
    const out = applyBoardFactFirewall(
      hyp([{ boardClaimId: "no-existe", use: "supportingFact", copiedValues: { delta: 1 } }]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.reflection.confidence).toBeLessThanOrEqual(0.3);
    if (out.response.mode === "hypothesis") {
      expect(out.response.confidenceCap).toBeLessThanOrEqual(0.3);
    }
  });

  it("11b. downgrade on a diagnosis (no confidenceCap) lowers only reflection.confidence, no crash", () => {
    const out = applyBoardFactFirewall(
      diag([{ boardClaimId: "no-existe", use: "supportingFact", copiedValues: { delta: 1 } }]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.response.mode).toBe("diagnosis");
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.reflection.confidence).toBeLessThanOrEqual(0.3);
    expect("confidenceCap" in out.response).toBe(false);
  });

  it("12. mixed: one invalid supportingFact + one honest limitation -> downgraded true (from support only), limitation survives", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "no-existe", use: "supportingFact", copiedValues: { delta: 1 } },
        { boardClaimId: "zona-ciega", use: "limitation" },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts).toHaveLength(1);
    expect(advice.supportingFacts[0]).toEqual({ boardClaimId: "zona-ciega", use: "limitation" });
    const invalidated = out.audit.filter((a) => a.invalidatedSupport);
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0].use).toBe("supportingFact");
  });

  it("13. question mode -> passthrough, empty audit, downgraded false", () => {
    const questionResponse: import("../src/ai/CoachSchemas").CoachResponse = {
      mode: "question",
      intent: {
        domains: ["pressing"],
        specificity: "specific",
        requestType: "diagnosis",
        impliedClaims: [],
      },
      selectedQuestions: [],
      blockedClaims: [],
      evidenceAudit: {
        covered: [],
        missing: [],
        criticalMissingCount: 0,
        evidenceStrength: "partial",
      },
      confidenceCap: 0.5,
    };

    const out = applyBoardFactFirewall(questionResponse, packet());

    expect(out.downgraded).toBe(false);
    expect(out.audit).toEqual([]);
    expect(out.response).toEqual(questionResponse);
  });

  it("14. sanitized response re-parses against CoachResponseSchema", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "no-existe", use: "supportingFact", copiedValues: { delta: 1 } },
        { boardClaimId: "zona-ciega", use: "limitation", copiedValues: { delta: -1 } },
        { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { delta: 1 } },
      ]),
      packet(),
    );

    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("15. supportingFact with empty copiedValues {} -> strip + downgrade, audit missing-copied-values, output re-parses", () => {
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: {} as never },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("missing-copied-values");
    expect(out.audit[0].invalidatedSupport).toBe(true);
    expect(adviceOf(out.response as { advice: CoachMatchAdvice }).supportingFacts).toHaveLength(0);
    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("16. supportingFact with foreign/unknown key {delta:1, ghost:999} -> strip + downgrade, audit field-incompatible, output re-parses", () => {
    const out = applyBoardFactFirewall(
      hyp([
        {
          boardClaimId: "presion-zona-3",
          use: "supportingFact",
          copiedValues: { delta: 1, ghost: 999 } as never,
        },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(true);
    expect(out.audit[0].reason).toBe("field-incompatible");
    expect(out.audit[0].invalidatedSupport).toBe(true);
    expect(adviceOf(out.response as { advice: CoachMatchAdvice }).supportingFacts).toHaveLength(0);
    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("17a. kept supportingFact copiedValues is rebuilt FROM THE CLAIM (own deep-equals claim own)", () => {
    const out = applyBoardFactFirewall(
      hyp([{ boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { own: 3 } }]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    expect(out.audit).toEqual([]);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts).toHaveLength(1);
    expect(advice.supportingFacts[0].copiedValues).toEqual({ own: 3 });

    // Prove the displayed number originates from the AUTHORITATIVE claim, not the ref.
    const claim = packet().boardEvidence.factualClaims.find((c) => c.id === "presion-zona-3");
    const claimOwn = claim && claim.kind === "zone-count" ? claim.own : undefined;
    expect(advice.supportingFacts[0].copiedValues?.own).toBe(claimOwn);
    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("17b. kept supportingFact only carries the compatible fields the ref attempted (rebuilt subset)", () => {
    const out = applyBoardFactFirewall(
      hyp([
        {
          boardClaimId: "presion-zona-3",
          use: "supportingFact",
          copiedValues: { own: 3, delta: 1 },
        },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts[0].copiedValues).toEqual({ own: 3, delta: 1 });
    expect(advice.supportingFacts[0].copiedValues).not.toHaveProperty("rival");
    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("18. questionTrigger { delta: 1, ghost: undefined } -> kept, output has NO ghost, re-parses universally", () => {
    const out = applyBoardFactFirewall(
      hyp([
        {
          boardClaimId: "presion-zona-3",
          use: "questionTrigger",
          copiedValues: { delta: 1, ghost: undefined } as never,
        },
      ]),
      packet(),
    );

    expect(out.downgraded).toBe(false);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts).toHaveLength(1);
    const kept = advice.supportingFacts[0];
    expect(kept.use).toBe("questionTrigger");
    expect(kept.copiedValues).toEqual({ delta: 1 });
    expect(kept.copiedValues).not.toHaveProperty("ghost");
    // The residual the red-team found: ghost survived and reparse was false.
    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("19. PERMANENT claim-sourced regression lock: copiedValues { delta: -0 } with claim delta 0 -> output delta is +0 from the claim, not the ref", () => {
    const zeroPacket = packet({
      factualClaims: [
        {
          id: "delta-cero",
          kind: "zone-count",
          zoneLabel: "Delta cero",
          own: 2,
          rival: 2,
          delta: 0,
          grounded: true,
        },
      ],
    });
    const out = applyBoardFactFirewall(
      hyp([
        { boardClaimId: "delta-cero", use: "supportingFact", copiedValues: { delta: -0 } },
      ]),
      zeroPacket,
    );

    expect(out.downgraded).toBe(false);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    const delta = advice.supportingFacts[0].copiedValues?.delta;
    expect(Object.is(delta, 0)).toBe(true);
    expect(Object.is(delta, -0)).toBe(false);
    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
  });

  it("20. universal re-parse: mixed valid SF + limitation w/ junk values + questionTrigger w/ junk-undefined key -> re-parses, and every kept ref is a FRESH object", () => {
    const inputs: CoachBoardClaimReference[] = [
      { boardClaimId: "presion-zona-3", use: "supportingFact", copiedValues: { delta: 1 } },
      { boardClaimId: "zona-ciega", use: "limitation", copiedValues: { delta: -1 } },
      {
        boardClaimId: "presion-zona-3",
        use: "questionTrigger",
        copiedValues: { delta: 1, ghost: undefined } as never,
      },
    ];
    const response = hyp(inputs);
    const inputRefs =
      response.mode !== "question" ? [...response.advice.supportingFacts] : [];

    const out = applyBoardFactFirewall(response, packet());

    expect(CoachResponseSchema.safeParse(out.response).success).toBe(true);
    const advice = adviceOf(out.response as { advice: CoachMatchAdvice });
    expect(advice.supportingFacts.length).toBeGreaterThan(0);
    for (const kept of advice.supportingFacts) {
      for (const original of inputRefs) {
        expect(kept).not.toBe(original);
      }
    }
  });

  it("does not mutate the input response", () => {
    const input = hyp([
      { boardClaimId: "no-existe", use: "supportingFact", copiedValues: { delta: 1 } },
    ]);
    const inputConfidence = input.mode !== "question" ? input.advice.reflection.confidence : 0;
    applyBoardFactFirewall(input, packet());

    expect(input.mode !== "question" && input.advice.reflection.confidence).toBe(inputConfidence);
    expect(input.mode !== "question" && input.advice.supportingFacts).toHaveLength(1);
  });
});

function advice(patch: Partial<CoachMatchAdvice> = {}): CoachMatchAdvice {
  return {
    tacticalReading: "El equipo no encuentra salida interior.",
    problemBreakdown: {
      zone: "Carril central",
      moment: "Inicio de jugada",
      trigger: "Presion rival sobre el pivote",
      ownVsRival: "Falta apoyo propio ante presion rival",
    },
    probableCause: "El 5 recibe de espaldas sin tercer hombre.",
    mainAdjustment: "Acercar apoyo y orientar recepcion antes del primer pase.",
    alternativeAdjustments: [],
    onFieldInstructions: ["Perfilar antes de recibir."],
    wednesdayTest: "Rondo posicional de salida.",
    saturdayFocus: "Primer pase limpio.",
    adjustmentRisks: [],
    successSignals: ["Menos perdidas en salida."],
    reflection: {
      mainUncertainty: "Faltan clips.",
      missingInformation: "Falta rival y zona exacta.",
      alternativeInterpretation: "Puede ser distancia entre apoyos.",
      confidence: 0.82,
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
    supportingFacts: [],
    ...patch,
  };
}
