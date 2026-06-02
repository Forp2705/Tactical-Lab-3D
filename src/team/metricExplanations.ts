import type { CoachShapeMetrics } from "@/state/useAppStore";

export type MetricExplanation = {
  id: keyof Pick<
    CoachShapeMetrics,
    "width" | "depth" | "compactness" | "blockHeight"
  > | "lineDistance";
  label: string;
  value: string;
  reading: string;
  risk: string;
  tone: "ok" | "warn" | "danger";
};

export function explainShapeMetrics(
  metrics?: CoachShapeMetrics | null,
): MetricExplanation[] {
  if (!metrics) return [];

  return [
    {
      id: "width",
      label: "Ancho",
      value: `${metrics.width.toFixed(1)}m`,
      reading:
        metrics.width >= 42
          ? "Hay amplitud suficiente para estirar al rival."
          : "El equipo puede estar demasiado angosto para progresar por fuera.",
      risk:
        metrics.width > 58
          ? "Riesgo: si se pierde, las ayudas llegan tarde."
          : "Riesgo bajo si el lado debil acompana la basculacion.",
      tone: metrics.width < 36 || metrics.width > 58 ? "warn" : "ok",
    },
    {
      id: "depth",
      label: "Profundidad",
      value: `${metrics.depth.toFixed(1)}m`,
      reading:
        metrics.depth >= 42
          ? "El equipo ocupa largo suficiente para amenazar espalda."
          : "La estructura puede estar corta y sin amenaza profunda.",
      risk:
        metrics.depth > 62
          ? "Riesgo: bloque largo y segunda pelota dificil de sostener."
          : "Riesgo controlable si las lineas se mueven juntas.",
      tone: metrics.depth < 30 || metrics.depth > 62 ? "warn" : "ok",
    },
    {
      id: "compactness",
      label: "Compacidad",
      value: `${metrics.compactness.toFixed(1)}m`,
      reading:
        metrics.compactness <= 22
          ? "Distancias colectivas razonables para presionar y cubrir."
          : "El equipo empieza a separarse: presionar asi exige mucha coordinacion.",
      risk:
        metrics.compactness > 28
          ? "Riesgo alto: saltos individuales y pases entre lineas."
          : "Riesgo medio si la presion al poseedor no llega.",
      tone:
        metrics.compactness > 28
          ? "danger"
          : metrics.compactness > 22
            ? "warn"
            : "ok",
    },
    {
      id: "lineDistance",
      label: "Dist. entre lineas",
      value: lineDistanceValue(metrics),
      reading:
        (metrics.lineDistances.defenseToMidfield ?? 0) <= 16
          ? "Defensa y mediocampo estan conectados."
          : "Hay espacio para que el rival reciba entre lineas.",
      risk:
        (metrics.lineDistances.defenseToMidfield ?? 0) > 20
          ? "Riesgo alto: el mediocentro rival puede girar o descargar de cara."
          : "Riesgo controlable si el pivote tapa el carril central.",
      tone:
        (metrics.lineDistances.defenseToMidfield ?? 0) > 20
          ? "danger"
          : (metrics.lineDistances.defenseToMidfield ?? 0) > 16
            ? "warn"
            : "ok",
    },
    {
      id: "blockHeight",
      label: "Altura bloque",
      value: `${metrics.blockHeight.toFixed(1)}m`,
      reading:
        metrics.blockHeight >= 64
          ? "Bloque alto: busca defender hacia adelante."
          : metrics.blockHeight <= 42
            ? "Bloque bajo/medio-bajo: prioriza proteger espalda."
            : "Bloque medio con margen para saltar o replegar.",
      risk:
        metrics.blockHeight >= 72
          ? "Riesgo: espalda de centrales si no hay presion al poseedor."
          : "Riesgo ligado a distancias entre lineas y velocidad de centrales.",
      tone:
        metrics.blockHeight >= 72 || metrics.blockHeight <= 34 ? "warn" : "ok",
    },
  ];
}

function lineDistanceValue(metrics: CoachShapeMetrics) {
  const defMid = metrics.lineDistances.defenseToMidfield;
  const midAtt = metrics.lineDistances.midfieldToAttack;
  return [
    defMid === undefined ? "" : `D-M ${defMid.toFixed(1)}m`,
    midAtt === undefined ? "" : `M-A ${midAtt.toFixed(1)}m`,
  ]
    .filter(Boolean)
    .join(" / ") || "s/d";
}
