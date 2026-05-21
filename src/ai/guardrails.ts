import type { AiPlan } from "./outputSchemas";

export function withGuardrails(plan: AiPlan) {
  return {
    ...plan,
    assumptions: uniqueList(plan.assumptions).slice(0, 5),
    confidence: Math.max(0.15, Math.min(0.95, plan.confidence)),
    checklist: uniqueList([
      "Confirmar cantidad real de jugadores",
      "Confirmar espacio disponible",
      "Confirmar nivel y carga del dia",
      ...plan.checklist,
    ]).slice(0, 6),
    abpSuggestions: uniqueList(plan.abpSuggestions),
    risks: uniqueList(plan.risks),
    why: uniqueList(plan.why),
    linkedExercises: uniqueList(plan.linkedExercises),
  };
}

export function fallbackPlan(mode: AiPlan["mode"], title: string): AiPlan {
  if (mode === "query") {
    return withGuardrails({
      mode,
      assumptions: [
        "Equipo amateur/semi-pro",
        "Consulta local",
        "Gemini no disponible o sin respuesta valida",
      ],
      confidence: 0.55,
      planA:
        "Respuesta: puedo trabajar con tu contexto actual, pero necesito una consigna tactica concreta para afinar la lectura.",
      planB:
        "Alternativa: formula la consulta con rival, sistema propio, zona del campo y problema observado.",
      abpSuggestions: [],
      risks: [
        "Responder demasiado generico si falta informacion del rival o del plantel",
      ],
      why: [
        "Una consulta tactica util necesita contexto, no solo una recomendacion automatica",
      ],
      checklist: [
        "Indicar sistema propio",
        "Indicar sistema rival",
        "Describir el problema en una frase",
      ],
      linkedExercises: [],
    });
  }

  const base = {
    mode,
    assumptions: [
      "Equipo amateur/semi-pro",
      "Sesion local",
      "Sin contexto medico completo",
    ],
    confidence: 0.62,
    planA: `${title}: sostener la idea principal con dos focos maximos y una consigna de timing.`,
    planB:
      "Reducir espacio si baja la precision, o subir oposicion si se busca ritmo competitivo.",
    planC:
      mode === "match"
        ? "Plan C: bloquear carril central, orientar banda y atacar segunda jugada."
        : undefined,
    abpSuggestions: [
      "Trabajar primer palo y rechace",
      "Agregar segunda jugada si el rival despeja",
    ],
    risks: [
      "Sobrecarga de intensidad si se concatenan demasiados bloques",
      "Demasiadas consignas simultaneas",
    ],
    why: [
      "La sesion necesita un foco claro para ser entendible en 5 segundos",
      "El riesgo principal es perder legibilidad",
    ],
    checklist: [
      "Revisar material",
      "Definir intensidad",
      "Elegir 1-2 objetivos maximos",
    ],
    linkedExercises: [],
  } satisfies AiPlan;

  return withGuardrails(base);
}

function uniqueList(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}
