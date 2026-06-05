export type CoachPromptMode =
  | "question"
  | "hypothesis"
  | "diagnosis"
  | "generalExplanation"
  | "sessionPlan";

const MODE_INSTRUCTIONS: Record<CoachPromptMode, string> = {
  question: `
Modo QUESTION:
- No diagnostiques una causa cerrada.
- Prioriza incertidumbre, evidencia faltante y preguntas de alto valor.
- Si incluis advice por fallback, mantenelo como lectura preliminar.
`.trim(),
  hypothesis: `
Modo HYPOTHESIS:
- Da una hipotesis operativa, no una conclusion cerrada.
- Explicita que falta confirmar y baja la confianza si no hay evidencia actual.
- Las acciones deben ser reversibles o testeables en entrenamiento.
`.trim(),
  diagnosis: `
Modo DIAGNOSIS:
- Solo afirma causa principal si hay evidencia suficiente en el catalogo.
- Cita fuentes actuales o reportes relevantes para sostener zona, trigger y sujeto.
- El ajuste principal debe ser ejecutable por staff y medible con successSignals.
`.trim(),
  generalExplanation: `
Modo GENERAL EXPLANATION:
- Explica el principio tactico sin fingir que aplica a este equipo.
- Usa ejemplos concretos y deja claro que no es diagnostico del caso.
- No cites memoria del club como prueba de un problema actual.
`.trim(),
  sessionPlan: `
Modo SESSION PLAN:
- Organiza la respuesta como plan de entrenamiento accionable.
- Conecta ejercicios, consignas, riesgos y medicion.
- Si falta evidencia, propone una tarea diagnostica antes del ajuste fuerte.
`.trim(),
};

export function getCoachModeInstructions(mode: CoachPromptMode) {
  return MODE_INSTRUCTIONS[mode];
}

export function inferCoachPromptMode(input: string): CoachPromptMode {
  const normalized = input.toLowerCase();
  if (/explic|como funciona|principio|concepto/.test(normalized)) {
    return "generalExplanation";
  }
  if (/sesion|microciclo|entrenamiento|ejercicio|planificar/.test(normalized)) {
    return "sessionPlan";
  }
  return "diagnosis";
}
