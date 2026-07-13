import type { BoardScene } from "../boardModel";

type TacticalBoardFooterProps = {
  scenes: BoardScene[];
  currentSceneId: string;
  status: string;
  saveIndicator: string;
  // W25C: timestamp del ultimo guardado REAL — clave del pulso, no del texto
  // (el texto cambia cada segundo por el tick de recencia, esto no).
  saveKey: number;
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
  saveIndicator,
  saveKey,
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
      <strong>Anotaciones que se convierten en entrenamiento</strong>
      {/* H7 (W24): unica senal de guardado del panel — reemplaza la
          competencia entre el boton "Guardar" del header y este texto.
          status sigue vivo para feedback puntual de otras acciones
          (duplicar escena, exportar imagen, etc.), nunca para "guardado". */}
      <span
        className="rombo-board-save-indicator"
        aria-live="polite"
        key={saveKey}
      >
        {saveIndicator}
      </span>
      {status ? <span className="rombo-board-status">{status}</span> : null}
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
