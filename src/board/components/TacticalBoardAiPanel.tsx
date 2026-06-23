import type { SessionBlock } from "@/data";
import { blockTitle } from "../boardGeometry";
import type { BoardPayload, PlanningBoardLayer } from "../productBoardTypes";

type TacticalBoardAiPanelProps = {
  aiInterpretation: string[];
  layers: PlanningBoardLayer[];
  payload: BoardPayload | null;
  attachBlockId: string;
  sessionBlocks: SessionBlock[];
  canDeleteScene: boolean;
  onToggleLayer: (layerId: string) => void;
  onCreatePayload: () => void;
  onExportImage: () => void;
  onExportBrief: (audience: "player" | "staff") => void;
  onDuplicateScene: () => void;
  onDeleteCurrentScene: () => void;
  onAttachBlockIdChange: (blockId: string) => void;
  onAttachToBlock: () => void;
  onCreateSessionBlock: () => void;
};

export function TacticalBoardAiPanel({
  aiInterpretation,
  layers,
  payload,
  attachBlockId,
  sessionBlocks,
  canDeleteScene,
  onToggleLayer,
  onCreatePayload,
  onExportImage,
  onExportBrief,
  onDuplicateScene,
  onDeleteCurrentScene,
  onAttachBlockIdChange,
  onAttachToBlock,
  onCreateSessionBlock,
}: TacticalBoardAiPanelProps) {
  return (
    <>
      <section>
        <h2>Que entiende la IA</h2>
        <ul className="rombo-ai-list">
          {aiInterpretation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Capas / vistas</h2>
        <div className="rombo-layer-list">
          {layers.map((layer) => (
            <label key={layer.id}>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggleLayer(layer.id)}
              />
              {layer.name}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2>Acciones</h2>
        <button
          type="button"
          className="rombo-primary-cta compact"
          onClick={onCreatePayload}
        >
          Enviar al generador
        </button>
        <button type="button" onClick={onExportImage}>
          Exportar imagen
        </button>
        <button type="button" onClick={() => onExportBrief("staff")}>
          Exportar brief imprimible
        </button>
        <button type="button" onClick={() => onExportBrief("player")}>
          Brief jugadores
        </button>
        <button type="button" onClick={onDuplicateScene}>
          Duplicar escena
        </button>
        <button
          type="button"
          onClick={onDeleteCurrentScene}
          disabled={!canDeleteScene}
        >
          Eliminar escena
        </button>
        <select
          value={attachBlockId}
          onChange={(event) => onAttachBlockIdChange(event.target.value)}
        >
          <option value="">Vincular a bloque...</option>
          {sessionBlocks.map((block, index) => (
            <option key={block.id} value={block.id}>
              {index + 1}. {blockTitle(block)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAttachToBlock}
          disabled={!attachBlockId}
        >
          Vincular escena
        </button>
        <button type="button" onClick={onCreateSessionBlock}>
          Crear bloque desde escena
        </button>
      </section>

      {payload ? (
        <section className="rombo-payload">
          <h2>Payload listo</h2>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </section>
      ) : null}
    </>
  );
}
