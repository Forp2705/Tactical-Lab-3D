import type { Alert, Exercise, Microcycle, Session } from "@/data";
import { catalog } from "@/data";

export function computeMicrocycleAlerts(
  microcycle: Microcycle,
  session: Session,
  exercises: Exercise[] = catalog,
): Alert[] {
  return [
    ...highLoadStreakAlerts(microcycle),
    ...abpCoverageAlerts(session, exercises),
    ...exerciseRepetitionAlerts(session),
    ...sessionLoadAlerts(session),
  ];
}

function highLoadStreakAlerts(microcycle: Microcycle): Alert[] {
  const days = Object.entries(microcycle.days);
  let streak = 0;

  for (const [, day] of days) {
    streak = day.targetLoad === "high" ? streak + 1 : 0;
    if (streak >= 3) {
      return [
        {
          severity: "warn",
          message: "Hay 3 o mas dias seguidos de carga alta en el microciclo.",
        },
      ];
    }
  }

  return [];
}

function abpCoverageAlerts(session: Session, exercises: Exercise[]): Alert[] {
  const hasAbp = session.blocks.some((block) => {
    const exercise = exercises.find((item) => item.id === block.exerciseId);
    return exercise?.phase === "abpOff" || exercise?.phase === "abpDef";
  });

  return hasAbp
    ? []
    : [
        {
          severity: "info",
          message: "La sesion actual no incluye ABP ofensiva ni defensiva.",
        },
      ];
}

function exerciseRepetitionAlerts(session: Session): Alert[] {
  const counts = new Map<string, number>();
  for (const block of session.blocks) {
    counts.set(block.exerciseId, (counts.get(block.exerciseId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .map(([exerciseId, count]) => ({
      severity: "warn" as const,
      message: `El ejercicio ${exerciseId} aparece ${count} veces en la sesion.`,
    }));
}

function sessionLoadAlerts(session: Session): Alert[] {
  const load = session.computed?.totalLoad ?? 0;
  if (load < 520) return [];

  return [
    {
      severity: load > 700 ? "error" : "warn",
      message: `Carga estimada alta para una sesion: ${load}. Revisar duracion, RPE y pausas.`,
    },
  ];
}
