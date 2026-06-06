import { z } from "zod";

export const GameModelSchema = z.object({
  identity: z.string().default(""),
  defensivePrinciples: z.array(z.string()).default([]),
  offensivePrinciples: z.array(z.string()).default([]),
  pressing: z.object({
    height: z.enum(["low", "mid", "high"]),
    triggers: z.array(z.string()).default([]),
    fallback: z.string().default(""),
  }),
  blockHeight: z.enum(["low", "mid", "high"]),
  buildUp: z.array(z.string()).default([]),
  progression: z.array(z.string()).default([]),
  organizedAttack: z.array(z.string()).default([]),
  defensiveTransition: z.array(z.string()).default([]),
  offensiveTransition: z.array(z.string()).default([]),
  setPieces: z.array(z.string()).default([]),
  acceptedRisks: z.array(z.string()).default([]),
  nonNegotiables: z.array(z.string()).default([]),
  coachLanguage: z.string().default("Directo, claro y orientado a acciones."),
  updatedAt: z.string().optional(),
});

export type GameModel = z.infer<typeof GameModelSchema>;

export const EMPTY_GAME_MODEL: GameModel = {
  identity: "",
  defensivePrinciples: [],
  offensivePrinciples: [],
  pressing: {
    height: "mid",
    triggers: [],
    fallback: "",
  },
  blockHeight: "mid",
  buildUp: [],
  progression: [],
  organizedAttack: [],
  defensiveTransition: [],
  offensiveTransition: [],
  setPieces: [],
  acceptedRisks: [],
  nonNegotiables: [],
  coachLanguage: "",
};

export const DEFAULT_GAME_MODEL: GameModel = {
  identity:
    "Equipo agresivo, protagonista sin pelota, con presion tras perdida y ataques por banda.",
  defensivePrinciples: [
    "Achicar hacia adelante cuando la pelota viaja atras.",
    "Bloque compacto con distancias cortas entre defensa y mediocampo.",
    "Cerrar pasillos interiores antes de saltar al duelo exterior.",
  ],
  offensivePrinciples: [
    "Salir con apoyos cercanos y tercer hombre cuando el rival presiona.",
    "Atacar con amplitud real y ocupar area con minimo dos referencias.",
    "No rifar la primera progresion si el pivote esta libre.",
  ],
  pressing: {
    height: "high",
    triggers: [
      "Pase atras al central o arquero.",
      "Control orientado hacia banda.",
      "Recepcion de espaldas del mediocentro rival.",
    ],
    fallback:
      "Si el primer salto llega tarde, replegar a bloque medio y cerrar dentro.",
  },
  blockHeight: "mid",
  buildUp: [
    "Centrales abiertos y pivote ofreciendo linea de pase interior.",
    "Lateral del lado fuerte da altura solo si hay cobertura del interior.",
  ],
  progression: [
    "Buscar tercer hombre para romper primera linea.",
    "Acelerar cuando el extremo recibe perfilado contra lateral.",
  ],
  organizedAttack: [
    "Extremos dan amplitud y los interiores atacan intervalos.",
    "El 9 fija centrales y recibe apoyos cercanos tras descarga.",
  ],
  defensiveTransition: [
    "Cinco segundos de presion tras perdida si hay densidad cercana.",
    "Si no hay densidad, falta tactica o repliegue inmediato hacia carril central.",
  ],
  offensiveTransition: [
    "Primer pase seguro, segundo pase vertical.",
    "Atacar espalda del lateral rival si el extremo ya esta alto.",
  ],
  setPieces: [
    "Defender primer contacto y segunda pelota.",
    "Atacar zona de penal con bloqueos simples.",
  ],
  acceptedRisks: [
    "Aceptar espalda a centrales solo si la presion al poseedor esta activa.",
    "Aceptar lateral alto si el interior cierra su espalda.",
  ],
  nonNegotiables: [
    "No quedar partido entre lineas.",
    "Presionar como bloque, no por impulsos individuales.",
    "El 9 no puede quedar aislado mas de dos posesiones seguidas.",
  ],
  coachLanguage: "Directo, accionable, sin vender humo y con evidencia.",
};

export function normalizeGameModel(value: unknown): GameModel {
  return GameModelSchema.catch(DEFAULT_GAME_MODEL).parse(value);
}

export function isGameModelConfigured(model: GameModel | null | undefined) {
  if (!model) return false;
  return Boolean(
    model.identity.trim() ||
      model.defensivePrinciples.length ||
      model.offensivePrinciples.length ||
      model.pressing.triggers.length ||
      model.buildUp.length ||
      model.nonNegotiables.length,
  );
}

export function summarizeGameModel(model: GameModel) {
  return [
    `Identidad: ${model.identity}`,
    `Defensa: ${model.defensivePrinciples.slice(0, 3).join("; ") || "sin definir"}`,
    `Ataque: ${model.offensivePrinciples.slice(0, 3).join("; ") || "sin definir"}`,
    `Presion: altura ${heightLabel(model.pressing.height)}; gatillos ${model.pressing.triggers.slice(0, 3).join("; ") || "sin definir"}`,
    `Altura de bloque buscada: ${heightLabel(model.blockHeight)}`,
    `No negociables: ${model.nonNegotiables.slice(0, 4).join("; ") || "sin definir"}`,
    `Riesgos aceptados: ${model.acceptedRisks.slice(0, 3).join("; ") || "sin definir"}`,
    `Lenguaje del DT: ${model.coachLanguage}`,
  ].join("\n");
}

export function contrastTextWithGameModel(
  text: string,
  model: GameModel,
): {
  aligned: string[];
  contradictions: string[];
  insufficientEvidence: string[];
} {
  const normalized = normalize(text);
  const aligned: string[] = [];
  const contradictions: string[] = [];
  const insufficientEvidence: string[] = [];

  if (model.pressing.height === "high") {
    if (hasAny(normalized, ["presion alta", "presionar alto", "tras perdida"])) {
      aligned.push("La lectura refuerza la presion alta/tras perdida del modelo.");
    }
    if (hasAny(normalized, ["repliegue bajo", "bloque bajo", "no presiona"])) {
      contradictions.push(
        "El modelo pide presion alta, pero aparece repliegue o falta de salto.",
      );
    }
  }

  if (model.blockHeight !== "low" && hasAny(normalized, ["bloque bajo", "hundido"])) {
    contradictions.push(
      "La altura de bloque observada parece mas baja que la buscada por el modelo.",
    );
  }

  if (
    model.nonNegotiables.some((item) => normalize(item).includes("partido")) &&
    hasAny(normalized, ["bloque partido", "entre lineas", "distancia alta"])
  ) {
    contradictions.push(
      "Quedar partido entre lineas contradice un no negociable del modelo.",
    );
  }

  if (
    model.nonNegotiables.some((item) => normalize(item).includes("9")) &&
    hasAny(normalized, ["9 aislado", "delantero aislado", "sin apoyos"])
  ) {
    contradictions.push("El 9 aislado contradice el no negociable de apoyos cercanos.");
  }

  if (hasAny(normalized, ["salida limpia", "tercer hombre", "pivote libre"])) {
    aligned.push("La salida/progresion mencionada coincide con principios ofensivos.");
  }

  if (!aligned.length && !contradictions.length) {
    insufficientEvidence.push(
      "No hay suficiente evidencia textual para afirmar alineacion o desvio del modelo.",
    );
  }

  return { aligned, contradictions, insufficientEvidence };
}

function heightLabel(value: "low" | "mid" | "high") {
  if (value === "high") return "alta";
  if (value === "mid") return "media";
  return "baja";
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
