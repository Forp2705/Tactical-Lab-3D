import { VIEW_OPTIONS } from "../boardConstants";
import type { CurrentBoardView } from "../productBoardTypes";

type TacticalBoardTopbarProps = {
  currentView: CurrentBoardView;
  canUndo: boolean;
  canRedo: boolean;
  onAddScene: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCurrentViewChange: (view: CurrentBoardView) => void;
  onSaveBoard: () => void;
};

// W15: sin marca ni titulo propios — duplicaban el sidebar y el header de
// vista (doble branding prohibido por LENGUAJE-ROMBOIQ). Barra solo-controles.
export function TacticalBoardTopbar({
  currentView,
  canUndo,
  canRedo,
  onAddScene,
  onUndo,
  onRedo,
  onCurrentViewChange,
  onSaveBoard,
}: TacticalBoardTopbarProps) {
  return (
    <header className="rombo-board-topbar">
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
      <button type="button" className="rombo-save" onClick={onSaveBoard}>
        Guardar
      </button>
    </header>
  );
}
