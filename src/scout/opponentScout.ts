import { z } from "zod";
import type { GameModel } from "@/data/gameModel";

export const OpponentScoutSchema = z.object({
  rival: z.string().default("Rival a definir"),
  probableSystem: z.string().default(""),
  pressing: z.string().default(""),
  buildUp: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
  keyPlayers: z.array(z.string()).default([]),
  setPieces: z.string().default(""),
  rhythm: z.string().default(""),
  risks: z.array(z.string()).default([]),
  notes: z.string().default(""),
  updatedAt: z.string().optional(),
});

export type OpponentScout = z.infer<typeof OpponentScoutSchema>;

export type OpponentGamePlan = {
  plan: string[];
  attackIt: string[];
  defendIt: string[];
  weeklyTrainingFocus: string[];
  openQuestions: string[];
  matchAlerts: string[];
};

export const DEFAULT_OPPONENT_SCOUT: OpponentScout = {
  rival: "Proximo rival",
  probableSystem: "",
  pressing: "",
  buildUp: "",
  strengths: [],
  vulnerabilities: [],
  keyPlayers: [],
  setPieces: "",
  rhythm: "",
  risks: [],
  notes: "",
};

export function normalizeOpponentScout(value: unknown): OpponentScout {
  return OpponentScoutSchema.catch(DEFAULT_OPPONENT_SCOUT).parse(value);
}

export function hasOpponentScoutData(scout: OpponentScout) {
  return Boolean(
    scout.rival.trim() &&
      [
        scout.probableSystem,
        scout.pressing,
        scout.buildUp,
        scout.setPieces,
        scout.rhythm,
        scout.notes,
        ...scout.strengths,
        ...scout.vulnerabilities,
        ...scout.keyPlayers,
        ...scout.risks,
      ].some((item) => item.trim()),
  );
}

export function summarizeOpponentScout(scout: OpponentScout) {
  if (!hasOpponentScoutData(scout)) return "No opponent scout loaded.";

  return [
    `Rival: ${scout.rival}`,
    scout.probableSystem ? `Sistema probable: ${scout.probableSystem}` : "",
    scout.pressing ? `Presion: ${scout.pressing}` : "",
    scout.buildUp ? `Salida: ${scout.buildUp}` : "",
    scout.strengths.length ? `Fortalezas: ${scout.strengths.join("; ")}` : "",
    scout.vulnerabilities.length
      ? `Vulnerabilidades: ${scout.vulnerabilities.join("; ")}`
      : "",
    scout.keyPlayers.length ? `Jugadores clave: ${scout.keyPlayers.join("; ")}` : "",
    scout.setPieces ? `Pelota parada: ${scout.setPieces}` : "",
    scout.rhythm ? `Ritmo: ${scout.rhythm}` : "",
    scout.risks.length ? `Riesgos: ${scout.risks.join("; ")}` : "",
    scout.notes ? `Notas: ${scout.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOpponentGamePlan(
  scout: OpponentScout,
  gameModel: GameModel,
): OpponentGamePlan {
  const pressing = normalize(scout.pressing);
  const buildUp = normalize(scout.buildUp);
  const vulnerabilities = scout.vulnerabilities.filter(Boolean);
  const strengths = scout.strengths.filter(Boolean);
  const risks = scout.risks.filter(Boolean);
  const plan: string[] = [];
  const attackIt: string[] = [];
  const defendIt: string[] = [];
  const weeklyTrainingFocus: string[] = [];
  const openQuestions: string[] = [];
  const matchAlerts: string[] = [];

  if (scout.probableSystem.trim()) {
    plan.push(`Preparar el partido contra ${scout.probableSystem} sin cambiar la identidad base.`);
  }

  if (pressing.includes("alta") || pressing.includes("alto")) {
    attackIt.push("Preparar salida con tercer hombre y pase de seguridad al lado debil.");
    weeklyTrainingFocus.push("Salida bajo presion con pivote y apoyo del interior.");
    matchAlerts.push("Si el primer pase interior no esta claro, no forzar perdida central.");
  }

  if (buildUp.includes("corta") || buildUp.includes("central")) {
    defendIt.push("Orientar presion hacia banda y tapar retorno al pivote.");
    weeklyTrainingFocus.push("Gatillos de presion sobre central abierto y recepcion de espaldas.");
  }

  for (const vulnerability of vulnerabilities.slice(0, 3)) {
    attackIt.push(`Atacar vulnerabilidad detectada: ${vulnerability}.`);
    weeklyTrainingFocus.push(`Ejercicio con foco en: ${vulnerability}.`);
  }

  for (const strength of strengths.slice(0, 3)) {
    defendIt.push(`Protegerse de fortaleza rival: ${strength}.`);
    matchAlerts.push(`No alimentar su fortaleza: ${strength}.`);
  }

  for (const risk of risks.slice(0, 3)) {
    matchAlerts.push(risk);
  }

  if (gameModel.pressing.height === "high") {
    plan.push("Usar la presion del modelo, pero solo sostenerla si el equipo llega junto.");
  }

  if (!scout.pressing.trim()) openQuestions.push("Como presiona el rival cuando pierde la pelota?");
  if (!scout.buildUp.trim()) openQuestions.push("Como inicia: corto, directo o mixto?");
  if (!scout.setPieces.trim()) openQuestions.push("Que amenaza tiene en pelota parada?");

  return {
    plan: plan.length ? plan : ["Definir un plan con una fortaleza rival y una vulnerabilidad concreta."],
    attackIt: attackIt.length ? attackIt : ["Buscar una vulnerabilidad verificable antes de ajustar el plan ofensivo."],
    defendIt: defendIt.length ? defendIt : ["No hay evidencia suficiente para modificar el plan defensivo."],
    weeklyTrainingFocus: weeklyTrainingFocus.length
      ? unique(weeklyTrainingFocus).slice(0, 4)
      : ["Cargar mas scout para convertirlo en foco semanal."],
    openQuestions,
    matchAlerts: unique(matchAlerts).slice(0, 5),
  };
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
