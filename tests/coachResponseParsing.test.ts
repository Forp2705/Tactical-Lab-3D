import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  isJsonModeUnsupportedError,
  parseCoachAdvice,
  resolveModelLadder,
} from "../src/ai/coachResponseParsing";

const VALID_ADVICE = {
  tacticalReading: "El equipo queda largo entre volantes y defensores.",
  probableCause: "Los volantes saltan sin que la ultima linea achique.",
  mainAdjustment: "Coordinar alturas antes de saltar.",
  onFieldInstructions: [
    "Si salta el punta, acompana el volante cercano.",
    "Si la defensa no achica, el medio no salta tan alto.",
    "Cerrar pase interior antes de presionar al poseedor.",
  ],
  wednesdayTest: "Probar bloque medio contra suplentes.",
  saturdayFocus: "Evitar que el equipo se parta tras perdida.",
  adjustmentRisks: ["Quedar pasivos si nadie salta.", "Regalar salida limpia."],
  successSignals: ["Bloque mas corto.", "Menos recepciones entre lineas."],
  reflection: {
    mainUncertainty: "No hay clips suficientes del segundo tiempo.",
    missingInformation: "Faltan zonas exactas de las perdidas.",
    alternativeInterpretation: "Puede ser cansancio y no decision tactica.",
    confidence: 0.72,
  },
};

describe("coach response parsing", () => {
  it("extrae JSON aunque venga envuelto en markdown y prosa", () => {
    const raw = `Lectura preliminar\n\n\`\`\`json\n${JSON.stringify(VALID_ADVICE)}\n\`\`\`\n`;
    expect(JSON.parse(extractJsonObject(raw))).toEqual(VALID_ADVICE);
  });

  it("respeta llaves dentro de strings al recortar el objeto", () => {
    const raw = `texto antes ${JSON.stringify({
      ...VALID_ADVICE,
      tacticalReading: "Presion {aparente} sin cobertura.",
    })} texto despues`;

    expect(JSON.parse(extractJsonObject(raw)).tacticalReading).toBe(
      "Presion {aparente} sin cobertura.",
    );
  });

  it("valida el schema final del coach", () => {
    expect(parseCoachAdvice(JSON.stringify(VALID_ADVICE))).toEqual({
      ...VALID_ADVICE,
      linkedExercises: [],
      actions: [],
      evidenceCitations: [],
    });
  });

  it("acepta acciones ejecutables del Lineup Lab 3D", () => {
    const parsed = parseCoachAdvice(
      JSON.stringify({
        ...VALID_ADVICE,
        actions: [
          {
            type: "applyShape",
            shapeId: "shape-attack",
            label: "Aplicar shape ofensivo",
          },
          {
            type: "createExerciseFromShape",
            shapeId: "shape-defense",
            title: "Trabajo de repliegue desde 4-4-2",
          },
        ],
      }),
    );

    expect(parsed.actions).toEqual([
      {
        type: "applyShape",
        shapeId: "shape-attack",
        label: "Aplicar shape ofensivo",
      },
      {
        type: "createExerciseFromShape",
        shapeId: "shape-defense",
        title: "Trabajo de repliegue desde 4-4-2",
      },
    ]);
  });

  it("deduplica y ordena la escalera de modelos", () => {
    expect(
      resolveModelLadder("model-a", "model-b, model-a, model-c, ,model-b"),
    ).toEqual(["model-a", "model-b", "model-c"]);
  });

  it("detecta errores de JSON mode no soportado", () => {
    expect(
      isJsonModeUnsupportedError(
        new Error("400 Bad Request: response_format json_object unsupported"),
      ),
    ).toBe(true);
    expect(isJsonModeUnsupportedError(new Error("401 Unauthorized"))).toBe(
      false,
    );
  });
});
