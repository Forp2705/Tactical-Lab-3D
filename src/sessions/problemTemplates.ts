import type { TacticalDomain } from "@/ai/CoachSchemas";

// Quick Start: "Problema -> Sesion lista".
//
// Cada template es un problema concreto, curado a mano, que alimenta los
// motores existentes de diagnostico/sesion sin pasar por el LLM. El campo
// `seed` es el texto que consume `matchExercisesForDiagnosis`; `domains`
// fuerza el dominio tactico para mantener la seleccion deterministica y
// curada, en vez de depender solo de la inferencia por texto.
export type ProblemTemplate = {
  id: string;
  chipLabel: string;
  description: string;
  domains: TacticalDomain[];
  objective: string;
  successSignal: string;
  seed: string;
  priority?: number;
};

export const PROBLEM_TEMPLATES: ProblemTemplate[] = [
  {
    id: "salida-bajo-presion",
    chipLabel: "No salimos limpio",
    description: "Nos aprietan y perdemos la pelota saliendo.",
    domains: ["buildUp"],
    objective: "Construir desde el fondo superando la primera presion.",
    successSignal:
      "Salir jugando y superar la primera linea de presion sin perdidas evitables.",
    seed: "Nos aprietan y perdemos la pelota saliendo. Trabajar salida limpia desde el fondo, apoyos del pivote, perfil de recepcion y lineas de pase para progresar superando la primera presion.",
    priority: 1,
  },
  {
    id: "generar-chances",
    chipLabel: "No generamos chances",
    description: "Llegamos al ultimo tercio pero no rematamos.",
    domains: ["attack"],
    objective: "Progresar y llegar a zona de remate con criterio.",
    successSignal:
      "Llegar al area con remates claros y no quedarnos en aproximaciones.",
    seed: "Llegamos al ultimo tercio pero no rematamos. Trabajar progresion, amplitud, ruptura y finalizacion para generar situaciones de remate con criterio.",
    priority: 2,
  },
  {
    id: "romper-bloque-bajo",
    chipLabel: "No rompemos el bloque bajo",
    description: "Nos esperan atras y no encontramos espacios.",
    domains: ["attack", "buildUp"],
    objective: "Atacar bloque replegado generando superioridades.",
    successSignal:
      "Generar superioridades y espacios para romper un bloque que espera atras.",
    seed: "Nos esperan atras y no encontramos espacios. Trabajar ataque contra bloque bajo, superioridades, amplitud, tercer hombre y ruptura para romper lineas juntas.",
    priority: 3,
  },
  {
    id: "presion-alta",
    chipLabel: "Nos cuesta presionar arriba",
    description: "Saltamos a presionar y nos la sacan facil.",
    domains: ["pressing"],
    objective: "Coordinar presion alta y orientar la salida rival.",
    successSignal:
      "Saltar coordinados y orientar la salida rival para recuperar en campo rival.",
    seed: "Saltamos a presionar y nos la sacan facil. Trabajar presion alta coordinada, saltos, orientar la salida y tapar lineas de pase para recuperar arriba.",
    priority: 4,
  },
  {
    id: "evitar-contras",
    chipLabel: "Nos contragolpean",
    description: "Perdemos la pelota y nos parten en transicion.",
    domains: ["defensiveTransition"],
    objective:
      "Reaccionar tras perdida y cortar contras antes del ultimo tercio.",
    successSignal:
      "Reaccionar tras perdida y frenar la contra antes de que llegue a zona de remate.",
    seed: "Perdemos la pelota y nos parten en transicion. Trabajar transicion defensiva, reaccion tras perdida, repliegue y presion tras perdida para cortar contras antes del ultimo tercio.",
    priority: 5,
  },
];

export function getProblemTemplate(
  templateId: string,
): ProblemTemplate | undefined {
  return PROBLEM_TEMPLATES.find((template) => template.id === templateId);
}
