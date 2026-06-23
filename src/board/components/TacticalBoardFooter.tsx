import type { BoardScene } from "../boardModel";

type TacticalBoardFooterProps = {
  scenes: BoardScene[];
  currentSceneId: string;
  status: string;
  zoom: number;
  onSelectScene: (sceneId: string) => void;
  onAddScene: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onMoveScene: () => void;
};

export function TacticalBoardFooter({
  scenes,
  currentSceneId,
  status,
  zoom,
  onSelectScene,
  onAddScene,
  onZoomOut,
  onZoomIn,
  onMoveScene,
}: TacticalBoardFooterProps) {
  return (
    <footer className="rombo-board-footer">
      <select
        value={currentSceneId}
        onChange={(event) => onSelectScene(event.target.value)}
      >
        {scenes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <button type="button" onClick={onAddScene}>
        +
      </button>
      <span>Pizarra de planificacion</span>
      <strong>Anotaciones para generar secuencias</strong>
      <span>{status}</span>
      <button type="button" onClick={onZoomOut}>
        -
      </button>
      <span>{zoom}%</span>
      <button type="button" onClick={onZoomIn}>
        +
      </button>
      <button type="button" onClick={onMoveScene}>
        Mover escena
      </button>
    </footer>
  );
}
