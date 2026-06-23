import { VIEW_OPTIONS } from "../boardConstants";
import type { CurrentBoardView } from "../productBoardTypes";

type TacticalBoardTopbarProps = {
  projectLabel: string;
  currentView: CurrentBoardView;
  canUndo: boolean;
  canRedo: boolean;
  onAddScene: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCurrentViewChange: (view: CurrentBoardView) => void;
  onCreatePayload: () => void;
  onSaveBoard: () => void;
};

export function TacticalBoardTopbar({
  projectLabel,
  currentView,
  canUndo,
  canRedo,
  onAddScene,
  onUndo,
  onRedo,
  onCurrentViewChange,
  onCreatePayload,
  onSaveBoard,
}: TacticalBoardTopbarProps) {
  return (
    <header className="rombo-board-topbar">
      <div className="rombo-brand">RomboIQ</div>
      <div className="rombo-title-block">
        <h1>Pizarra tactica</h1>
        <p>Proyecto: {projectLabel}</p>
      </div>
      <button type="button" onClick={onAddScene}>
        Nueva escena
      </button>
      <div className="rombo-board-undo">
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      </div>
      <label className="rombo-board-select">
        Vista actual
        <select
          value={currentView}
          onChange={(event) =>
            onCurrentViewChange(event.target.value as CurrentBoardView)
          }
        >
          {VIEW_OPTIONS.map((view) => (
            <option key={view}>{view}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="rombo-primary-cta"
        onClick={onCreatePayload}
      >
        Generar secuencia desde pizarra
        <span>Las anotaciones se envian al generador</span>
      </button>
      <button type="button" onClick={onCreatePayload}>
        Compartir
      </button>
      <button type="button" className="rombo-save" onClick={onSaveBoard}>
        Guardar
      </button>
    </header>
  );
}
