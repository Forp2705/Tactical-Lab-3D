import type { CoachShapeMetrics } from "@/state/useAppStore";
import type { Exercise, Player } from "@/data";
import type { GameModel } from "@/data/gameModel";
import { inferDomainsFromText, matchExercisesForDiagnosis } from "@/ai/exerciseMatching";
import {
  analyzePlayerFit,
  type PlayerFitFinding,
  type TacticalAdjustment,
} from "@/ai/playerFit";

export type ScenarioId =
  | "switch-433"
  | "raise-block"
  | "drop-block"
  | "third-center-back"
  | "free-fullback"
  | "pivot-role"
  | "high-press"
  | "direct-play"
  | "counterpress"
  | "protect-weak-side"
  | "support-nine";

export type ScenarioInput = {
  scenarioId: ScenarioId;
  objective?: string;
  currentShapeName?: string;
  metrics?: CoachShapeMetrics | null;
  gameModel: GameModel;
  players: Player[];
  evidenceText?: string;
  patterns?: string[];
  exercises: Exercise[];
};

export type ScenarioSimulation = {
  scenarioId: ScenarioId;
  title: string;
  expectedBenefit: string;
  mainRisk: string;
  lineImpact: {
    defense: string;
    midfield: string;
    attack: string;
  };
  benefitedPlayers: string[];
  exposedPlayers: string[];
  gameModelCompatibility: "aligned" | "conditional" | "contradiction";
  exercisesToTest: Array<{ id: string; title: string; reason: string }>;
  validationSignals: string[];
  confidence: "low" | "medium" | "high";
  evidenceLevel: "none" | "weak" | "partial" | "sufficient";
  fitFindings: PlayerFitFinding[];
};

const SCENARIOS: Record<
  ScenarioId,
  {
    title: string;
    adjustment: TacticalAdjustment;
    query: string;
    benefit: string;
    risk: string;
    defense: string;
    midfield: string;
    attack: string;
    signals: string[];
  }
> = {
  "switch-433": {
    title: "Pasar de 4-4-2 a 4-3-3",
    adjustment: "pivotRoleChange",
    query: "4-3-3 salida interior amplitud presion alta",
    benefit: "Mas amplitud, mejor ocupacion de pasillos interiores y una primera presion con tres referencias.",
    risk: "El mediocampo puede quedar partido si el 5 no sostiene la base.",
    defense: "Centrales necesitan amplitud y cobertura preventiva.",
    midfield: "El pivote ordena alturas; interiores deben llegar a apoyo y presion.",
    attack: "Extremos fijan por fuera y el 9 gana apoyos para descarga.",
    signals: ["El pivote recibe perfilado", "Los extremos no vuelven a la misma altura que los laterales"],
  },
  "raise-block": {
    title: "Subir el bloque",
    adjustment: "highBlock",
    query: "bloque alto presion recuperar tras perdida",
    benefit: "Recuperar mas cerca del arco rival y achicar recorridos ofensivos.",
    risk: "Espalda de centrales expuesta si la presion al poseedor llega tarde.",
    defense: "Defensa achica junta y el arquero sostiene profundidad.",
    midfield: "Mediocampo tapa pases interiores antes de saltar.",
    attack: "Primer salto orienta hacia banda o pase atras.",
    signals: ["No hay pase frontal limpio rival", "La defensa no corre hacia atras en cada perdida"],
  },
  "drop-block": {
    title: "Bajar bloque",
    adjustment: "lowBlock",
    query: "bloque medio bajo defender centros segunda pelota",
    benefit: "Reducir espalda y proteger centrales lentos o ventaja en el resultado.",
    risk: "Ceder iniciativa y alejar al 9 de apoyos reales.",
    defense: "Linea protege area y evita ser atraida fuera.",
    midfield: "Volantes cierran carril central y saltan solo con cobertura.",
    attack: "Delanteros preparan primera descarga para salir.",
    signals: ["El rival centra forzado", "La primera descarga tras recuperacion tiene receptor cercano"],
  },
  "third-center-back": {
    title: "Agregar tercer central",
    adjustment: "threeCenterBacks",
    query: "tercer central proteger area liberar carrileros",
    benefit: "Mejor control de area y coberturas para liberar carrileros.",
    risk: "Perder un pase interior si el medio queda en inferioridad.",
    defense: "Tres centrales reparten marcas y cobertura de espalda.",
    midfield: "El doble pivote debe evitar quedar hundido.",
    attack: "Carrileros dan amplitud y atacan segundo palo.",
    signals: ["El central libre corrige sin salir lejos", "Carrileros llegan con ventaja y no tarde"],
  },
  "free-fullback": {
    title: "Liberar lateral",
    adjustment: "freeFullback",
    query: "lateral alto amplitud extremo interior cobertura",
    benefit: "Ganar amplitud alta y superioridad por fuera.",
    risk: "2v1 defensivo en banda si el extremo no repliega o el interior no cubre.",
    defense: "Interior del lado fuerte cierra espalda del lateral.",
    midfield: "El pivote bascula para tapar perdida.",
    attack: "Extremo puede venir dentro y lateral fija por fuera.",
    signals: ["El lateral recibe de cara", "No hay contra por su espalda tras perdida"],
  },
  "pivot-role": {
    title: "Cambiar rol del 5",
    adjustment: "pivotRoleChange",
    query: "pivote salida interior recepcion presion",
    benefit: "Ordenar salida y presion desde una referencia central.",
    risk: "Perdida central si recibe sin perfil o sin apoyo corto.",
    defense: "El 5 protege frontal de centrales.",
    midfield: "Interiores escalonan apoyos y no se esconden.",
    attack: "Permite progresar por tercer hombre.",
    signals: ["El 5 juega a dos toques", "El rival no roba de frente en zona central"],
  },
  "high-press": {
    title: "Presionar alto",
    adjustment: "highPress",
    query: "presion alta gatillos orientar salida rival",
    benefit: "Forzar errores y condicionar la salida rival.",
    risk: "Si un jugador salta solo, el equipo queda largo.",
    defense: "Linea acompana al salto y controla espalda.",
    midfield: "Volantes tapan pivote rival.",
    attack: "Delanteros orientan hacia el lado previsto.",
    signals: ["Rival juega largo incomodo", "No quedan dos lineas separadas tras el primer pase"],
  },
  "direct-play": {
    title: "Jugar mas directo",
    adjustment: "directPlay",
    query: "juego directo segunda pelota apoyo al 9",
    benefit: "Evitar perdidas en salida si el rival presiona alto.",
    risk: "Partir al equipo si no se prepara segunda pelota.",
    defense: "Bloque sube despues del envio para no quedar largo.",
    midfield: "Volantes atacan segunda pelota.",
    attack: "El 9 descarga y extremos atacan espalda.",
    signals: ["Segunda pelota disputada por tres jugadores propios", "El 9 no pelea aislado"],
  },
  counterpress: {
    title: "Cambiar comportamiento tras perdida",
    adjustment: "counterPress",
    query: "presion tras perdida transicion defensiva cerrar carril central",
    benefit: "Recuperar rapido y evitar contraataques.",
    risk: "Si no hay densidad cerca, la presion tras perdida abre espacios.",
    defense: "Centrales previenen pase profundo.",
    midfield: "El mas cercano presiona y los demas cierran dentro.",
    attack: "Extremos y 9 bloquean primer pase de salida.",
    signals: ["Primer pase rival sale hacia banda", "Si no hay densidad, el equipo repliega sin dudar"],
  },
  "protect-weak-side": {
    title: "Proteger banda debil",
    adjustment: "protectWeakSide",
    query: "banda debil basculacion cobertura lateral extremo",
    benefit: "Reducir cambios de orientacion que terminan en 1v1 o centro limpio.",
    risk: "Hundirse demasiado y perder amenaza en salida.",
    defense: "Lateral debil cierra segundo palo.",
    midfield: "Interior debil no se desconecta de la basculacion.",
    attack: "Extremo debil queda listo para atacar espalda si se recupera.",
    signals: ["No hay receptor libre a espalda del lateral", "El extremo debil llega a cerrar o amenaza salida"],
  },
  "support-nine": {
    title: "Acercar apoyos al 9",
    adjustment: "supportNine",
    query: "9 aislado apoyos descarga segunda jugada",
    benefit: "Convertir recepciones del 9 en continuidad y no en duelos perdidos.",
    risk: "Si todos se acercan, se pierde profundidad y amplitud.",
    defense: "Tras perdida cerca del 9, presion inmediata.",
    midfield: "Un interior llega a descarga y otro sostiene equilibrio.",
    attack: "El 9 fija y descarga con apoyos a menos de 15 metros.",
    signals: ["El 9 descarga de primera o segunda", "Hay remate o progresion tras la descarga"],
  },
};

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([id, scenario]) => ({
    id: id as ScenarioId,
    title: scenario.title,
  }));
}

export function simulateScenario(input: ScenarioInput): ScenarioSimulation {
  const scenario = SCENARIOS[input.scenarioId];
  const fitFindings = analyzePlayerFit(input.players, [scenario.adjustment]);
  const textContext = [
    scenario.query,
    input.objective,
    input.evidenceText,
    input.patterns?.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const exercises = matchExercisesForDiagnosis({
    domains: inferDomainsFromText(textContext),
    query: textContext,
    exercises: input.exercises,
    limit: 3,
  }).map((match) => ({
    id: match.exercise.id,
    title: match.exercise.title,
    reason: match.reasons[0] ?? `Compatible con ${match.matchedDomains.join(", ")}`,
  }));
  const evidenceLevel = computeEvidenceLevel(input);
  const confidence = computeConfidence(input.metrics, evidenceLevel, fitFindings);
  const compatibility = computeGameModelCompatibility(input.gameModel, scenario.adjustment);

  return {
    scenarioId: input.scenarioId,
    title: scenario.title,
    expectedBenefit: scenario.benefit,
    mainRisk: enrichRiskWithMetrics(scenario.risk, input.metrics),
    lineImpact: {
      defense: scenario.defense,
      midfield: scenario.midfield,
      attack: scenario.attack,
    },
    benefitedPlayers: playerLabels(
      fitFindings.filter((finding) => finding.level === "strength"),
    ),
    exposedPlayers: playerLabels(
      fitFindings.filter((finding) => finding.level !== "strength"),
    ),
    gameModelCompatibility: compatibility,
    exercisesToTest: exercises,
    validationSignals: scenario.signals,
    confidence,
    evidenceLevel,
    fitFindings,
  };
}

function computeGameModelCompatibility(
  gameModel: GameModel,
  adjustment: TacticalAdjustment,
): ScenarioSimulation["gameModelCompatibility"] {
  if (
    (adjustment === "highBlock" || adjustment === "highPress") &&
    gameModel.pressing.height === "high"
  ) {
    return "aligned";
  }
  if (adjustment === "lowBlock" && gameModel.pressing.height === "high") {
    return "contradiction";
  }
  if (adjustment === "directPlay" && gameModel.buildUp.length) {
    return "conditional";
  }
  return "conditional";
}

function computeEvidenceLevel(input: ScenarioInput): ScenarioSimulation["evidenceLevel"] {
  const sources = [
    input.metrics ? "metrics" : "",
    input.evidenceText?.trim() ? "evidence" : "",
    input.patterns?.length ? "patterns" : "",
  ].filter(Boolean).length;
  if (sources >= 3) return "sufficient";
  if (sources === 2) return "partial";
  if (sources === 1) return "weak";
  return "none";
}

function computeConfidence(
  metrics: CoachShapeMetrics | null | undefined,
  evidenceLevel: ScenarioSimulation["evidenceLevel"],
  findings: PlayerFitFinding[],
): ScenarioSimulation["confidence"] {
  const riskCount = findings.filter((finding) => finding.level === "risk").length;
  if (!metrics || evidenceLevel === "none" || riskCount >= 2) return "low";
  if (evidenceLevel === "sufficient" && riskCount === 0) return "high";
  return "medium";
}

function enrichRiskWithMetrics(risk: string, metrics?: CoachShapeMetrics | null) {
  if (!metrics) return `${risk} Confianza baja: no hay shape activo publicado.`;
  const alerts = [];
  if (metrics.compactness > 24) alerts.push("compacidad alta");
  if ((metrics.lineDistances.defenseToMidfield ?? 0) > 20) {
    alerts.push("distancia defensa-mediocampo alta");
  }
  if (metrics.blockHeight > 72) alerts.push("bloque muy alto");
  return alerts.length ? `${risk} Alerta shape: ${alerts.join(", ")}.` : risk;
}

function playerLabels(findings: PlayerFitFinding[]) {
  return [...new Set(findings.flatMap((finding) => finding.players))].slice(0, 5);
}
