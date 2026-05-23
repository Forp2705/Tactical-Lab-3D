import { describe, expect, it } from "vitest";
import {
  normalizePostMatchReport,
  parseOwnPerspectiveResult,
} from "../src/ai/post-match/generatePostMatchReport";
import {
  PostMatchInputSchema,
  PostMatchReportSchema,
} from "../src/ai/post-match/schemas";

describe("PostMatchReportSchema", () => {
  it("accepts grounded post-match sections without writing memory", () => {
    const report = PostMatchReportSchema.parse({
      matchContext: {
        opponent: "Cantinas FC",
        result: "5-0",
        interpretedResult: {
          ownGoals: 5,
          rivalGoals: 0,
          outcome: "win",
          label: "victoria propia 5 a 0",
        },
        ownSystem: "4-4-2",
        opponentSystem: "3-4-3",
      },
      executiveSummary: "Victoria propia con evidencia textual suficiente.",
      matchStory: "El equipo sostuvo el plan y ataco espacios rivales.",
      ownStrengths: [
        {
          strength: "Asociaciones cortas",
          evidence: ["EV-NOTES"],
        },
      ],
      ownProblems: [],
      ownTeamProblems: [
        {
          problem: "Bloque partido / defensa que no achica",
          evidence: ["EV-NOTES"],
          severity: "medium",
          probableCause:
            "Puntas y volantes saltaron sin que la defensa achique detras.",
        },
      ],
      conditioningContext: ["El equipo jugo con 10 durante parte del partido."],
      rivalVulnerabilities: [
        {
          vulnerability: "Linea alta con defensores lentos",
          evidence: ["EV-NOTES"],
          howWeExploitedIt: "Diagonales de delanteros.",
        },
      ],
      observedRisks: [
        {
          risk: "Sobrerreaccionar al resultado",
          evidence: ["EV-RESULT"],
          owner: "unknown",
        },
      ],
      tacticalTradeoffs: [
        {
          decision: "Presionar en bloque",
          upside: "Recuperar cerca del arco rival",
          downside: "Puede dejar espalda si se rompe la primera linea",
          subject: "own",
          evidence: ["EV-NOTES"],
        },
      ],
      flankAsymmetries: [
        {
          flank: "both",
          description: "No hay evidencia suficiente para separar bandas.",
          subject: "unknown",
          evidence: ["EV-NOTES"],
          implication: "Revisar tags por carril antes de fijarlo en memoria.",
        },
      ],
      tacticalInferences: [
        {
          inference: "El plan fue compatible con el rival observado",
          basedOn: ["EV-NOTES"],
          confidence: "medium",
        },
      ],
      memoryInfluence: [],
      grounding: {
        resultPerspective: "victoria propia 5 a 0",
        evidenceUsed: ["EV-RESULT", "EV-NOTES"],
        unsupportedClaims: [],
        subjectAttributionWarnings: [],
      },
      keyPatterns: [
        {
          pattern: "Atacar espalda de linea alta",
          evidence: ["EV-NOTES"],
          tacticalImpact: "Genero ventaja territorial.",
        },
      ],
      mainProblems: [],
      positives: ["Compromiso con la idea"],
      wednesdayTest: [
        {
          hypothesis: "La diagonal vuelve a generar ventaja",
          test: "Ensayo 4v4+2 con pase filtrado",
          successSignals: ["Recibir perfilado a espalda rival"],
        },
      ],
      saturdayFocus: [
        "Repetir el principio sin asumir que todo rival defiende alto",
      ],
      risksOfOvercorrection: [
        "No convertir una vulnerabilidad rival en regla fija",
      ],
      missingInformation: ["Minutos exactos de las acciones"],
      memoryCandidates: [
        {
          id: "mc_1",
          statement:
            "El equipo genero con mas fluidez por izquierda que por derecha.",
          category: "sideAsymmetry",
          evidence: ["EV-NOTES"],
          confidence: "medium",
          scope: "repeatWatch",
          selectedByStaff: false,
        },
      ],
      reflection: {
        mainUncertainty: "Falta video taggeado para medir repeticion.",
        alternativeInterpretation:
          "El marcador pudo amplificar una lectura puntual.",
        confidence: 0.72,
      },
    });

    expect(report.matchContext.interpretedResult?.outcome).toBe("win");
    expect(report.ownTeamProblems[0].problem).toContain("Bloque partido");
    expect(report.conditioningContext[0]).toContain("10");
    expect(report.memoryCandidates[0].category).toBe("sideAsymmetry");
    expect(report.memoryCandidates[0].selectedByStaff).toBe(false);
    expect(report.observedRisks[0].owner).toBe("unknown");
  });

  it("normalizes common LLM shape drift before zod validation", () => {
    const input = PostMatchInputSchema.parse({
      matchContext: {
        opponent: "Cantinas FC",
        result: "5-0",
        interpretedResult: parseOwnPerspectiveResult("5-0") ?? undefined,
        ownSystem: "4-4-2",
        opponentSystem: "3-4-3",
      },
      staffNotes:
        "El equipo jugo con 10 y genero mas fluidez por izquierda que por derecha.",
      tags: [],
    });

    const normalized = normalizePostMatchReport(
      {
        executiveSummary: "Victoria propia bien interpretada.",
        matchStory: "El equipo sostuvo el plan.",
        ownStrengths: {
          strength: "Compromiso con la idea",
          evidence: "EV-NOTES",
        },
        ownProblems: {
          problem: "Bloque partido",
          evidence: "EV-NOTES",
          severity: "media",
        },
        rivalVulnerabilities: {
          vulnerability: "Linea alta rival",
          evidence: "EV-NOTES",
          howWeExploitedIt: "Diagonales.",
        },
        observedRisks: {
          risk: "jugar con 10",
          evidence: "EV-NOTES",
          owner: "propio",
        },
        tacticalTradeoffs: {
          decision: "Pelota larga con sentido",
          upside: "Atacar espalda",
          downside: "Puede partir el bloque",
          subject: "propio",
          evidence: "EV-NOTES",
        },
        flankAsymmetries: {
          flank: "izquierda",
          description: "Mas fluidez izquierda que derecha",
          evidence: "EV-NOTES",
        },
        tacticalInferences: {
          inference: "Conviene coordinar alturas",
          basedOn: "EV-NOTES",
          confidence: "alta",
        },
        memoryInfluence: {
          memoryItem: "Dato previo",
          usedAs: "contextOnly",
          currentEvidence: "EV-NOTES",
        },
        grounding: {
          evidenceUsed: "EV-NOTES",
          unsupportedClaims: "",
          subjectAttributionWarnings: "",
        },
        keyPatterns: {
          pattern: "Atacar espalda de linea alta",
          evidence: "EV-NOTES",
          tacticalImpact: "Genero ventaja.",
        },
        mainProblems: {
          problem: "Bloque partido",
          probableCause: "Defensa no achica",
          severity: "medium",
          examplesToReview: "EV-NOTES",
        },
        positives: "Compromiso con la idea",
        wednesdayTest: {
          hypothesis: "Coordinar altura del bloque",
          test: "11v11 reducido",
          successSignals: "Defensa achica cuando saltan puntas",
        },
        saturdayFocus: "Coordinar bloque",
        risksOfOvercorrection: "No bajar el bloque por defecto",
        missingInformation: "Minutos exactos",
        memoryCandidates: {
          id: "mc_1",
          statement:
            "El equipo genero con mas fluidez por izquierda que por derecha.",
          category: "opponentPattern",
          evidence: "EV-NOTES",
          confidence: "alta",
          scope: "repeatWatch",
        },
        reflection: {
          mainUncertainty: "Falta video taggeado",
          alternativeInterpretation: "El rival pudo estar desordenado",
          confidence: "0.7",
        },
      },
      input,
    );

    const report = PostMatchReportSchema.parse(normalized);

    expect(report.ownStrengths[0].evidence).toEqual(["EV-NOTES"]);
    expect(report.tacticalInferences[0].basedOn).toEqual(["EV-NOTES"]);
    expect(report.flankAsymmetries[0].flank).toBe("left");
    expect(report.flankAsymmetries[0].subject).toBe("unknown");
    expect(report.reflection.confidence).toBe(0.7);
    expect(report.conditioningContext.length).toBeGreaterThan(0);
    expect(report.observedRisks).toEqual([]);
    expect(report.memoryCandidates[0].category).toBe("sideAsymmetry");
  });
});
