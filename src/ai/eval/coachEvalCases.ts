import type {
  CoachResponse,
  EvidenceStrength,
  TacticalDomain,
} from "../CoachSchemas";

export type ExpectedCoachBehavior = {
  mode: CoachResponse["mode"];
  minEvidenceStrength?: EvidenceStrength;
  requiredCitationTypes?: Array<"knowledge" | "memory" | "observation" | "report" | "video">;
  forbiddenClaims?: string[];
  requiredTerms?: string[];
};

export type CoachEvalCase = {
  id: string;
  title: string;
  input: string;
  domain: TacticalDomain;
  scenario: "vague" | "specific" | "video" | "memory" | "session" | "explanation";
  collectedEvidence?: Array<{ target: string; answer: string }>;
  expected: ExpectedCoachBehavior;
};

export const COACH_EVAL_CASES: CoachEvalCase[] = [
  caseItem("def-vague-001", "Defensa vaga por dentro", "Nos entran facil por dentro", "defense", "vague", "question", ["zona", "causa"]),
  caseItem("def-specific-002", "Bloque partido", "Nos parten entre volantes y defensores cuando el 5 salta y la defensa no achica", "defense", "specific", "hypothesis", ["bloque", "distancia"]),
  caseItem("press-vague-003", "Presion alta vaga", "La presion alta no funciona", "pressing", "vague", "question", ["gatillo", "rival"]),
  caseItem("press-specific-004", "Presion con central libre", "Saltamos con el 9, el extremo llega tarde y el central rival juega al pivote", "pressing", "specific", "hypothesis", ["gatillo", "cobertura"]),
  caseItem("build-vague-005", "Salida vaga", "Nos cuesta salir limpio", "buildUp", "vague", "question", ["zona", "rival"]),
  caseItem("build-specific-006", "Pivote de espaldas", "El 5 recibe de espaldas sin apoyo y perdemos el primer pase por dentro", "buildUp", "specific", "hypothesis", ["tercer hombre", "apoyo"]),
  caseItem("trans-vague-007", "Transicion vaga", "Nos matan de contra", "defensiveTransition", "vague", "question", ["perdida", "resguardo"]),
  caseItem("trans-specific-008", "Rest defense", "Perdemos en banda con los dos laterales altos y solo quedan dos por detras de la pelota", "defensiveTransition", "specific", "hypothesis", ["resguardo", "banda"]),
  caseItem("attack-vague-009", "Ataque vago", "No generamos situaciones", "attack", "vague", "question", ["zona", "9"]),
  caseItem("attack-specific-010", "9 aislado", "El 9 queda lejos de los interiores y recibe sin descarga frontal", "attack", "specific", "hypothesis", ["apoyo", "descarga"]),
  caseItem("abp-vague-011", "ABP vaga", "Nos hacen goles de pelota parada", "setPieces", "vague", "question", ["corner", "marca"]),
  caseItem("abp-specific-012", "Bloqueo segundo palo", "En corners nos bloquean al central y perdemos la segunda pelota en el segundo palo", "setPieces", "specific", "hypothesis", ["bloqueo", "segunda pelota"]),
  caseItem("duel-vague-013", "Duelos vagos", "Perdemos todos los duelos", "duels", "vague", "question", ["zona", "perfil"]),
  caseItem("duel-specific-014", "Lateral 1v1", "El lateral queda mano a mano porque el extremo no retrocede y el rival dobla por fuera", "duels", "specific", "hypothesis", ["cobertura", "banda"]),
  caseItem("block-specific-015", "Bloque largo", "El bloque queda largo despues del minuto 60 y el rival recibe entre lineas", "block", "specific", "hypothesis", ["momento", "bloque"]),
  caseItem("physical-016", "Caida fisica", "En el segundo tiempo dejamos de presionar y no sostenemos retornos", "physicalEmotional", "specific", "hypothesis", ["segundo tiempo", "carga"]),
  caseItem("system-017", "Cambio de sistema", "Queremos pasar de 4-3-3 a 4-4-2 sin perder presion por banda", "systemLineup", "specific", "hypothesis", ["shape", "banda"]),
  caseItem("explain-018", "Explicacion conceptual", "Explicame como funciona una presion alta orientada a banda", "pressing", "explanation", "hypothesis", ["principio", "banda"]),
  caseItem("session-019", "Sesion desde diagnostico", "Armame una sesion para corregir salida por dentro con el 5 tapado", "buildUp", "session", "hypothesis", ["ejercicio", "consigna"]),
  caseItem("video-020", "Video con timestamp", "Usa las marcas de video para explicar por que quedamos largos", "defense", "video", "hypothesis", ["video", "timestamp"], ["video"]),
  caseItem("memory-021", "Memoria historica", "Esto ya nos paso antes contra bloque bajo?", "attack", "memory", "hypothesis", ["memoria", "evidencia"], ["memory", "report"]),
  caseItem("contra-022", "Evitar sobrediagnostico", "Creo que el problema es el arquero, confirmamelo", "buildUp", "vague", "question", ["evidencia", "causa"], [], ["confirmado seguro"]),
  caseItem("risk-023", "Riesgo de ajuste", "Subimos la linea para presionar mas alto?", "pressing", "specific", "hypothesis", ["riesgo", "espalda"]),
  caseItem("model-024", "Contraste modelo", "Nuestro modelo pide extremos altos pero sufrimos transicion en banda", "defensiveTransition", "specific", "hypothesis", ["modelo", "tradeoff"]),
];

function caseItem(
  id: string,
  title: string,
  input: string,
  domain: TacticalDomain,
  scenario: CoachEvalCase["scenario"],
  mode: CoachResponse["mode"],
  requiredTerms: string[],
  requiredCitationTypes: ExpectedCoachBehavior["requiredCitationTypes"] = [],
  forbiddenClaims: string[] = [],
): CoachEvalCase {
  return {
    id,
    title,
    input,
    domain,
    scenario,
    expected: {
      mode,
      requiredTerms,
      requiredCitationTypes,
      forbiddenClaims,
    },
  };
}
