import type { BoardArrowSemantic, BoardZoneSemantic } from "./boardModel";

// Fuente UNICA de estilo por semantica de accion. La consumen el render vivo
// (TacticalBoardCanvas) y el export (tacticalBoardSceneSvgString) para que no
// diverjan: misma derivacion color/dash/curva. El export puede simplificar la
// GEOMETRIA (lineas rectas), no la semantica ni el anclaje.
export type ArrowStyle = {
  color: string;
  dashed: boolean;
  curved: boolean;
};

// Record => el compilador exige una entrada por cada semantica (red de
// seguridad: agregar una semantica nueva obliga a definir su estilo).
const ARROW_STYLES: Record<BoardArrowSemantic, ArrowStyle> = {
  pass: { color: "#5eead4", dashed: true, curved: false },
  longPass: { color: "#5eead4", dashed: true, curved: true },
  cross: { color: "#7dd3fc", dashed: true, curved: true },
  switch: { color: "#7dd3fc", dashed: true, curved: true },
  carry: { color: "#f8fafc", dashed: false, curved: false },
  shot: { color: "#facc15", dashed: false, curved: false },
  movement: { color: "#a7f3d0", dashed: false, curved: false },
  run: { color: "#5eead4", dashed: false, curved: true },
  support: { color: "#a7f3d0", dashed: false, curved: true },
  rotation: { color: "#c4b5fd", dashed: false, curved: true },
  pressure: { color: "#f87171", dashed: false, curved: false },
  mark: { color: "#fb923c", dashed: false, curved: false },
  cover: { color: "#d1d5db", dashed: true, curved: false },
  recovery: { color: "#fca5a5", dashed: true, curved: true },
};

export function arrowStyle(semantic: BoardArrowSemantic): ArrowStyle {
  return ARROW_STYLES[semantic];
}

const ZONE_COLORS: Record<BoardZoneSemantic, string> = {
  press: "#ff7474",
  occupation: "#5eead4",
  freeSpace: "#60a5fa",
  danger: "#f8d66d",
  block: "#c7df5f",
  channel: "#a7f3d0",
  custom: "#d8b4fe",
};

export function zoneStyle(semantic: BoardZoneSemantic): { color: string } {
  return { color: ZONE_COLORS[semantic] };
}
