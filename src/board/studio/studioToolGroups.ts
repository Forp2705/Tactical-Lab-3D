import { EQUIPMENT_TOOLS, TOOL_DEFS, type BoardTool } from "@/board/boardConstants";

/**
 * Vocabulario del rail del Estudio Tactico (W27), organizado por grupo tal
 * como MOCKUP-NORTE.html lo valida: EDICION / BALON / JUGADOR / DEFENSA /
 * CAMPO / MARCADOR. Tesis del norte: "claro" = todo bien organizado y
 * etiquetado, NUNCA "menos herramientas" — por eso este modulo existe
 * separado de la config vieja de boardConstants.ts (TOOL_GROUPS agrupa
 * distinto, pensado para el rail anterior) y trae su propio test de
 * coherencia: toda BoardTool real tiene que aparecer en EXACTAMENTE un
 * boton de un grupo, para que agregar una tool nueva al motor nunca
 * desaparezca en silencio del rail del Estudio.
 */

export type StudioRailButton = {
  // Id estable del boton (para key de React y tests). Para tools reales,
  // coincide con el BoardTool; para acciones especiales del estudio (que no
  // son una BoardTool 1:1 hoy), un id propio.
  id: string;
  label: string;
  // Presente cuando el boton selecciona una BoardTool real via a.setTool.
  tool?: BoardTool;
  // Accion especial del estudio, sin BoardTool 1:1 en el motor hoy:
  // - "erase": modo "pasar el borrador" (arma select + borra la proxima
  //   seleccion real), reusa deleteSelection() existente — no requiere tocar
  //   boardTools.ts.
  // - "note-gap" / "ball-gap": gap escalado al coordinador (ver worker_done);
  //   temporalmente alias de "move" para no romper nada mientras se resuelve.
  special?: "erase" | "note-gap" | "ball-gap";
};

export type StudioToolGroupId =
  | "edicion"
  | "balon"
  | "jugador"
  | "defensa"
  | "campo";

export type StudioToolGroup = {
  id: StudioToolGroupId;
  label: string;
  buttons: StudioRailButton[];
};

function toolButton(tool: BoardTool, label: string): StudioRailButton {
  return { id: tool, label, tool };
}

export const STUDIO_TOOL_GROUPS: StudioToolGroup[] = [
  {
    id: "edicion",
    label: "EDICIÓN",
    buttons: [
      toolButton("select", "Seleccionar"),
      toolButton("move", "Mover"),
      { id: "erase", label: "Borrar", special: "erase" },
      { id: "note", label: "Nota", special: "note-gap" },
    ],
  },
  {
    id: "balon",
    label: "BALÓN",
    buttons: [
      toolButton("pass", "Pase"),
      toolButton("longPass", "Pase largo"),
      toolButton("cross", "Centro"),
      toolButton("switch", "Cambio orient."),
      toolButton("carry", "Conducción"),
      toolButton("shot", "Disparo"),
    ],
  },
  {
    id: "jugador",
    label: "JUGADOR",
    buttons: [
      toolButton("movement", "Movimiento"),
      toolButton("run", "Desmarque"),
      toolButton("support", "Apoyo"),
      toolButton("rotation", "Rotación"),
    ],
  },
  {
    id: "defensa",
    label: "DEFENSA",
    buttons: [
      toolButton("pressure", "Presión"),
      toolButton("mark", "Marca"),
      toolButton("cover", "Cobertura"),
      toolButton("recovery", "Repliegue"),
    ],
  },
  {
    id: "campo",
    label: "CAMPO",
    buttons: [
      toolButton("zone", "Zona"),
      toolButton("block", "Bloque"),
      toolButton("cone", "Cono"),
      toolButton("goal", "Portería"),
      toolButton("mannequin", "Maniquí"),
      { id: "ball", label: "Pelota", special: "ball-gap" },
    ],
  },
];

// Toda BoardTool del motor (TOOL_DEFS) tiene que estar en exactamente un
// grupo del Estudio — ni ausente (vocabulario incompleto) ni duplicada
// (ambiguo cual grupo la controla). Ver tests/studioToolGroups.test.ts.
export function allStudioMappedTools(): BoardTool[] {
  return STUDIO_TOOL_GROUPS.flatMap((group) =>
    group.buttons.flatMap((button) => (button.tool ? [button.tool] : [])),
  );
}

export function studioButtonForTool(tool: BoardTool): StudioRailButton | undefined {
  for (const group of STUDIO_TOOL_GROUPS) {
    const found = group.buttons.find((button) => button.tool === tool);
    if (found) return found;
  }
  return undefined;
}

// Reexportado solo para que el test de coherencia no dependa de conocer el
// nombre exacto del modulo viejo.
export { TOOL_DEFS, EQUIPMENT_TOOLS };
