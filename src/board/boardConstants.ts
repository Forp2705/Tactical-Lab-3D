import type { BoardArrowSemantic } from "./boardModel";
import type {
  CurrentBoardView,
  ExerciseBuilder,
  PlanningBoardPlayer,
} from "./productBoardTypes";

// Las herramientas de dibujo SON semanticas de accion (sin capa lossy: la tool
// elegida es directamente el `semantic` de la flecha). Lo demas son tools
// especiales: navegacion, zonas tipadas y equipamiento.
export type BoardSpecialTool =
  | "select"
  | "move"
  | "zone"
  | "block"
  | "cone"
  | "goal"
  | "mannequin";
export type BoardTool = BoardSpecialTool | BoardArrowSemantic;

export type DraftPlayer = Omit<PlanningBoardPlayer, "id" | "team"> & {
  team: "A" | "B";
};

export type Selection =
  | { kind: "object"; id: string }
  | { kind: "arrow"; id: string }
  | { kind: "zone"; id: string }
  | null;

export const PITCH_W = 100;
export const PITCH_H = 64;
export const FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
  "5-4-1",
];
export const VIEW_OPTIONS: CurrentBoardView[] = [
  "Ataque",
  "Defensa",
  "Transicion",
  "ABP",
];

export const TOOL_DEFS: Array<{ id: BoardTool; label: string }> = [
  { id: "select", label: "Seleccionar" },
  { id: "move", label: "Mover" },
  // Balon
  { id: "pass", label: "Pase" },
  { id: "longPass", label: "Pase largo" },
  { id: "cross", label: "Centro" },
  { id: "switch", label: "Cambio de orientacion" },
  { id: "carry", label: "Conduccion" },
  { id: "shot", label: "Disparo" },
  // Jugador
  { id: "movement", label: "Movimiento" },
  { id: "run", label: "Desmarque" },
  { id: "support", label: "Apoyo" },
  { id: "rotation", label: "Rotacion" },
  // Defensa
  { id: "pressure", label: "Presion" },
  { id: "mark", label: "Marca" },
  { id: "cover", label: "Cobertura" },
  { id: "recovery", label: "Repliegue" },
  // Zonas
  { id: "zone", label: "Zona" },
  { id: "block", label: "Bloque" },
  // Equipamiento (submenu plegado, fuera del rail principal)
  { id: "cone", label: "Cono" },
  { id: "goal", label: "Porteria" },
  { id: "mannequin", label: "Maniqui" },
];

// El rail principal se arma por grupos de accion. El equipamiento vive aparte
// en un submenu plegable para no contaminar el vocabulario tactico.
export const TOOL_GROUPS: Array<{ label: string; tools: BoardTool[] }> = [
  { label: "Navegacion", tools: ["select", "move"] },
  { label: "Balon", tools: ["pass", "longPass", "cross", "switch", "carry", "shot"] },
  { label: "Jugador", tools: ["movement", "run", "support", "rotation"] },
  { label: "Defensa", tools: ["pressure", "mark", "cover", "recovery"] },
  { label: "Zonas", tools: ["zone", "block"] },
];

export const EQUIPMENT_TOOLS: BoardTool[] = ["cone", "goal", "mannequin"];

export const COLORS = [
  "#f8fafc",
  "#facc15",
  "#ff5b2e",
  "#1677ff",
  "#22c55e",
  "#8b5cf6",
];
export const LINE_WIDTHS = [1, 2, 3];

export const formationPoints: Record<
  string,
  Array<{ x: number; y: number; role: string }>
> = {
  "4-4-2": [
    { x: 8, y: 50, role: "Arquero" },
    { x: 22, y: 18, role: "Lateral derecho" },
    { x: 22, y: 38, role: "Central" },
    { x: 22, y: 62, role: "Central" },
    { x: 22, y: 82, role: "Lateral izquierdo" },
    { x: 45, y: 20, role: "Volante derecho" },
    { x: 45, y: 42, role: "Mediocentro" },
    { x: 45, y: 58, role: "Mediocentro" },
    { x: 45, y: 80, role: "Volante izquierdo" },
    { x: 72, y: 42, role: "Delantero" },
    { x: 72, y: 58, role: "Delantero" },
  ],
  "4-3-3": [
    { x: 8, y: 50, role: "Arquero" },
    { x: 22, y: 18, role: "Lateral derecho" },
    { x: 22, y: 38, role: "Central" },
    { x: 22, y: 62, role: "Central" },
    { x: 22, y: 82, role: "Lateral izquierdo" },
    { x: 43, y: 32, role: "Interior" },
    { x: 40, y: 50, role: "Mediocentro" },
    { x: 43, y: 68, role: "Interior" },
    { x: 72, y: 22, role: "Extremo derecho" },
    { x: 76, y: 50, role: "Delantero" },
    { x: 72, y: 78, role: "Extremo izquierdo" },
  ],
  "4-2-3-1": [
    { x: 8, y: 50, role: "Arquero" },
    { x: 22, y: 18, role: "Lateral derecho" },
    { x: 22, y: 38, role: "Central" },
    { x: 22, y: 62, role: "Central" },
    { x: 22, y: 82, role: "Lateral izquierdo" },
    { x: 39, y: 42, role: "Doble pivote" },
    { x: 39, y: 58, role: "Doble pivote" },
    { x: 58, y: 24, role: "Extremo" },
    { x: 60, y: 50, role: "Enganche" },
    { x: 58, y: 76, role: "Extremo" },
    { x: 77, y: 50, role: "Delantero" },
  ],
  "3-5-2": [
    { x: 8, y: 50, role: "Arquero" },
    { x: 24, y: 32, role: "Central" },
    { x: 21, y: 50, role: "Central" },
    { x: 24, y: 68, role: "Central" },
    { x: 45, y: 16, role: "Carrilero" },
    { x: 42, y: 38, role: "Interior" },
    { x: 41, y: 50, role: "Mediocentro" },
    { x: 42, y: 62, role: "Interior" },
    { x: 45, y: 84, role: "Carrilero" },
    { x: 72, y: 42, role: "Delantero" },
    { x: 72, y: 58, role: "Delantero" },
  ],
  "3-4-3": [
    { x: 8, y: 50, role: "Arquero" },
    { x: 24, y: 32, role: "Central" },
    { x: 21, y: 50, role: "Central" },
    { x: 24, y: 68, role: "Central" },
    { x: 44, y: 20, role: "Carrilero" },
    { x: 42, y: 43, role: "Mediocentro" },
    { x: 42, y: 57, role: "Mediocentro" },
    { x: 44, y: 80, role: "Carrilero" },
    { x: 72, y: 24, role: "Extremo" },
    { x: 76, y: 50, role: "Delantero" },
    { x: 72, y: 76, role: "Extremo" },
  ],
  "5-4-1": [
    { x: 8, y: 50, role: "Arquero" },
    { x: 20, y: 14, role: "Carrilero" },
    { x: 22, y: 34, role: "Central" },
    { x: 20, y: 50, role: "Central" },
    { x: 22, y: 66, role: "Central" },
    { x: 20, y: 86, role: "Carrilero" },
    { x: 44, y: 22, role: "Volante" },
    { x: 43, y: 43, role: "Mediocentro" },
    { x: 43, y: 57, role: "Mediocentro" },
    { x: 44, y: 78, role: "Volante" },
    { x: 72, y: 50, role: "Delantero" },
  ],
};

export const emptyDraft: DraftPlayer = {
  name: "",
  position: "",
  number: "",
  traits: "",
  team: "A",
  role: "",
  task: "",
};

export const exerciseFields: Array<{
  key: keyof ExerciseBuilder;
  label: string;
}> = [
  { key: "objective", label: "Objetivo" },
  { key: "players", label: "Jugadores" },
  { key: "space", label: "Espacio" },
  { key: "duration", label: "Duracion" },
  { key: "rule", label: "Regla" },
  { key: "successCondition", label: "Condicion de exito" },
  { key: "progression", label: "Progresion" },
  { key: "coachCorrection", label: "Correccion DT" },
];
