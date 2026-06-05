import type { Exercise } from "@/data";
import type { TacticalDomain } from "@/ai/CoachSchemas";

export type ExerciseMatch = {
  exercise: Exercise;
  score: number;
  matchedDomains: TacticalDomain[];
  reasons: string[];
};

type DomainRule = {
  phases: Exercise["phase"][];
  principleTerms: string[];
  objectiveTerms: string[];
  coachingTerms: string[];
};

const DOMAIN_RULES: Record<TacticalDomain, DomainRule> = {
  defense: {
    phases: ["defenseOrg"],
    principleTerms: ["defensa", "bloque", "bascular", "proteger"],
    objectiveTerms: ["defender", "bloque", "cerrar", "proteger"],
    coachingTerms: ["perfil", "cobertura", "distancia", "cerrar"],
  },
  pressing: {
    phases: ["defenseOrg", "transDef"],
    principleTerms: ["presion", "presión", "salto", "acoso"],
    objectiveTerms: ["presionar", "recuperar", "forzar"],
    coachingTerms: ["saltar", "orientar", "tapar", "activar"],
  },
  block: {
    phases: ["defenseOrg"],
    principleTerms: ["bloque", "compact", "bascular"],
    objectiveTerms: ["compactar", "bloque", "distancias"],
    coachingTerms: ["juntos", "lineas", "líneas", "achicar"],
  },
  buildUp: {
    phases: ["attackOrg"],
    principleTerms: ["salida", "progresion", "progresión", "apoyo"],
    objectiveTerms: ["salir", "progresar", "construir", "tercer hombre"],
    coachingTerms: ["perfil", "apoyo", "linea de pase", "línea de pase"],
  },
  defensiveTransition: {
    phases: ["transDef"],
    principleTerms: ["transicion defensiva", "transición defensiva", "perdida"],
    objectiveTerms: ["tras perdida", "tras pérdida", "reaccion", "reacción"],
    coachingTerms: ["replegar", "presion tras perdida", "cerrar"],
  },
  offensiveTransition: {
    phases: ["transOff"],
    principleTerms: ["transicion ofensiva", "transición ofensiva", "contra"],
    objectiveTerms: ["contraatacar", "atacar rapido", "atacar rápido"],
    coachingTerms: ["primer pase", "profundidad", "ruptura"],
  },
  attack: {
    phases: ["attackOrg"],
    principleTerms: ["ataque", "finalizacion", "finalización", "amplitud"],
    objectiveTerms: ["generar", "finalizar", "atacar", "progresar"],
    coachingTerms: ["apoyo", "ruptura", "amplitud", "area", "área"],
  },
  setPieces: {
    phases: ["abpOff", "abpDef"],
    principleTerms: ["abp", "corner", "tiro libre", "pelota parada"],
    objectiveTerms: ["pelota parada", "corner", "tiro libre"],
    coachingTerms: ["marca", "bloqueo", "rebote", "segunda pelota"],
  },
  duels: {
    phases: ["defenseOrg", "attackOrg", "transDef"],
    principleTerms: ["duelo", "1v1", "banda"],
    objectiveTerms: ["duelo", "superioridad", "banda"],
    coachingTerms: ["cuerpo", "perfil", "contacto", "temporizar"],
  },
  physicalEmotional: {
    phases: ["defenseOrg", "transDef"],
    principleTerms: ["intensidad", "ritmo", "carga"],
    objectiveTerms: ["intensidad", "competir", "sostener"],
    coachingTerms: ["pausa", "recuperar", "activar"],
  },
  systemLineup: {
    phases: ["attackOrg", "defenseOrg"],
    principleTerms: ["sistema", "lineup", "formacion", "formación"],
    objectiveTerms: ["organizar", "estructura", "roles"],
    coachingTerms: ["rol", "altura", "distancia", "perfil"],
  },
};

export function matchExercisesForDiagnosis({
  domains,
  query,
  exercises,
  limit = 3,
}: {
  domains: TacticalDomain[];
  query: string;
  exercises: Exercise[];
  limit?: number;
}): ExerciseMatch[] {
  const normalizedQuery = normalize(query);
  const effectiveDomains = domains.length ? domains : inferDomainsFromText(query);

  return exercises
    .map((exercise) => scoreExercise(exercise, effectiveDomains, normalizedQuery))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function inferDomainsFromText(text: string): TacticalDomain[] {
  const normalized = normalize(text);
  const domains: TacticalDomain[] = [];

  if (
    hasAny(normalized, [
      "salida",
      "salir",
      "construir",
      "progresar",
      "salir limpio",
      "salida limpia",
      "lo aprietan al 5",
      "5 lo aprietan",
      "cinco lo aprietan",
      "recibe de espaldas",
      "recibir de espaldas",
    ])
  ) {
    domains.push("buildUp");
  }
  if (
    hasAny(normalized, [
      "presion",
      "presionar",
      "salto",
      "apretar",
      "subir el bloque",
      "bloque alto",
    ])
  ) {
    domains.push("pressing");
  }
  if (hasAny(normalized, ["bloque", "hund", "largo", "partido", "linea alta"])) {
    domains.push("block");
  }
  if (
    hasAny(normalized, [
      "perdida",
      "perdemos",
      "perdemos la pelota",
      "transicion defensiva",
      "retroceso",
      "tras perder",
    ])
  ) {
    domains.push("defensiveTransition");
  }
  if (hasAny(normalized, ["contra", "transicion ofensiva", "atacar rapido"])) {
    domains.push("offensiveTransition");
  }
  if (hasAny(normalized, ["corner", "abp", "pelota parada", "tiro libre"])) {
    domains.push("setPieces");
  }
  if (
    hasAny(normalized, [
      "defender",
      "nos ganan por banda",
      "nos superan por fuera",
      "costado",
      "banda",
    ])
  ) {
    domains.push("defense");
  }
  if (hasAny(normalized, ["duelo", "1v1", "banda", "2v1"])) {
    domains.push("duels");
  }
  if (hasAny(normalized, ["atac", "gener", "9", "finaliz", "aislado"])) {
    domains.push("attack");
  }

  return domains.length ? [...new Set(domains)] : ["defense"];
}

function scoreExercise(
  exercise: Exercise,
  domains: TacticalDomain[],
  normalizedQuery: string,
): ExerciseMatch {
  const reasons: string[] = [];
  const matchedDomains: TacticalDomain[] = [];
  let score = 0;
  const text = normalize(
    [
      exercise.title,
      exercise.phase,
      exercise.principle,
      exercise.objective.primary,
      exercise.objective.secondary,
      exercise.coaching.join(" "),
      exercise.errors.join(" "),
    ].join(" "),
  );

  for (const domain of domains) {
    const rule = DOMAIN_RULES[domain];
    let domainScore = 0;

    if (rule.phases.includes(exercise.phase)) {
      domainScore += 4;
      reasons.push(`fase ${exercise.phase} compatible con ${domain}`);
    }
    domainScore += countHits(text, rule.principleTerms) * 2;
    domainScore += countHits(text, rule.objectiveTerms) * 2;
    domainScore += countHits(text, rule.coachingTerms);

    if (domainScore > 0) {
      matchedDomains.push(domain);
      score += domainScore;
    }
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter((term) => term.length > 4);
  const queryHits = queryTerms.filter((term) => text.includes(term)).length;
  score += Math.min(3, queryHits);

  return {
    exercise,
    score,
    matchedDomains,
    reasons: reasons.slice(0, 4),
  };
}

function countHits(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(normalize(term))).length;
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
