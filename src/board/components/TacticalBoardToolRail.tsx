import {
  type BoardTool,
  COLORS,
  EQUIPMENT_TOOLS,
  LINE_WIDTHS,
  TOOL_GROUPS,
} from "../boardConstants";
import { labelForTool } from "../boardTools";

type TacticalBoardToolRailProps = {
  tool: BoardTool;
  color: string;
  lineWidth: number;
  onToolChange: (tool: BoardTool) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (width: number) => void;
  onDeleteSelection: () => void;
};

export function TacticalBoardToolRail({
  tool,
  color,
  lineWidth,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onDeleteSelection,
}: TacticalBoardToolRailProps) {
  return (
    <aside className="rombo-toolrail" aria-label="Herramientas">
      <h2>Herramientas</h2>
      {TOOL_GROUPS.map((group) => (
        <div className="rombo-tool-group" key={group.label}>
          <h3>{group.label}</h3>
          {group.tools.map((id) => (
            <button
              type="button"
              key={id}
              className={tool === id ? "active" : ""}
              onClick={() => onToolChange(id)}
            >
              <ToolIcon tool={id} />
              <span>{labelForTool(id)}</span>
            </button>
          ))}
        </div>
      ))}
      <details className="rombo-tool-group rombo-equipment">
        <summary>Equipamiento</summary>
        {EQUIPMENT_TOOLS.map((id) => (
          <button
            type="button"
            key={id}
            className={tool === id ? "active" : ""}
            onClick={() => onToolChange(id)}
          >
            <ToolIcon tool={id} />
            <span>{labelForTool(id)}</span>
          </button>
        ))}
      </details>
      <div className="rombo-tool-group">
        <h3>Color y grosor</h3>
        <div className="rombo-color-row">
          {COLORS.map((item) => (
            <button
              type="button"
              key={item}
              className={color === item ? "selected" : ""}
              style={{ background: item }}
              aria-label={`Color ${item}`}
              onClick={() => onColorChange(item)}
            />
          ))}
        </div>
        <div className="rombo-width-row">
          {LINE_WIDTHS.map((width) => (
            <button
              type="button"
              key={width}
              className={lineWidth === width ? "active" : ""}
              onClick={() => onLineWidthChange(width)}
            >
              {width}
            </button>
          ))}
        </div>
        <button type="button" className="danger" onClick={onDeleteSelection}>
          Borrar seleccionado
        </button>
      </div>
    </aside>
  );
}

function ToolIcon({ tool }: { tool: BoardTool }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: "img",
    "aria-label": labelForTool(tool),
  };

  if (tool === "select") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M5 4l11 8-5 1.4 3 5.2-2.7 1.5-3-5.1-3.3 3z" />
      </svg>
    );
  }
  if (tool === "move") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M12 3v18M3 12h18M12 3l3 3M12 3L9 6M21 12l-3 3M21 12l-3-3M12 21l3-3M12 21l-3-3M3 12l3 3M3 12l3-3" />
      </svg>
    );
  }
  if (tool === "longPass" || tool === "cross") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 18L18 6" />
        <path d="M12 6h6v6" />
      </svg>
    );
  }
  if (tool === "pass") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 17c5-8 10 2 16-6" strokeDasharray="2 2" />
        <circle cx="5" cy="17" r="1.5" />
      </svg>
    );
  }
  if (tool === "run") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 18c4-10 11 0 16-10" />
        <path d="M15 7h5v5" />
      </svg>
    );
  }
  if (tool === "pressure") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 7h16M4 12h12M4 17h8" />
        <path d="M17 12l3-3M17 12l3 3" />
      </svg>
    );
  }
  if (tool === "zone" || tool === "block") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <rect x="4" y="6" width="16" height="12" rx="2" />
        {tool === "block" ? <path d="M8 10h8M8 14h8" /> : null}
      </svg>
    );
  }
  if (tool === "cone") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M12 5l5 14H7z" />
        <path d="M8.5 15h7" />
      </svg>
    );
  }
  if (tool === "goal") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M5 18V7h14v11" />
        <path d="M5 11h14M9 7v11M15 7v11" />
      </svg>
    );
  }
  if (tool === "mannequin") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v10M8 11h8M9 21h6" />
      </svg>
    );
  }
  if (tool === "shot") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <circle cx="6" cy="17" r="2" />
        <path d="M8 15l10-8" />
        <path d="M14 6h5v5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <title>{labelForTool(tool)}</title>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}
