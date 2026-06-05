import type { Session } from "@/data";

export const PILOT_DIAGNOSIS_PROMPT =
  "Cuando perdemos arriba, el pivote queda demasiado expuesto y el rival progresa por dentro. Necesito decidir si el ajuste principal debe ser la distancia interior-pivote o la altura de los extremos para sostener mejor la presión tras pérdida.";

export const PILOT_SESSION_BLOCKS: Session["blocks"] = [
  {
    id: "pilot-block-1",
    exerciseId: "rondo-4v2-dos-zonas",
    durationMin: 14,
    swappable: true,
    notes:
      "Objetivo: sostener la presión tras pérdida con ayudas cercanas. Coaching: atraer antes de cambiar, reaccionar cinco metros hacia la pérdida.",
  },
  {
    id: "pilot-block-2",
    exerciseId: "central-step-in",
    durationMin: 15,
    swappable: true,
    notes:
      "Objetivo: proteger al pivote y progresar sin dejar al bloque partido. Coaching: fijar al primer saltador y encontrar al mediocentro perfilado.",
  },
];

export const PILOT_SESSION_NOTES = [
  "Problema táctico activo: el rival progresa por dentro cuando la presión tras pérdida llega tarde.",
  "Ajuste semanal: acortar la distancia interior-pivote y coordinar la altura de los extremos antes de saltar.",
  "Qué debe resolver la sesión: que el equipo llegue junto a la segunda jugada y no deje al pivote defendiendo solo.",
].join("\n");
