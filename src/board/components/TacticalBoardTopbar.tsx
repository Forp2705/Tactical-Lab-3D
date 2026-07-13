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
      {/* H7 (W24): degradado de CTA prominente (gold, competia con la senal
          de autosave del footer) a accion secundaria. La pizarra se
          autoguarda sola; esto solo fuerza el volcado del objetivo/regla/
          exito al resumen que consume el brief exportable (saveBoard). */}
      <button
        type="button"
        className="rombo-save-secondary"
        onClick={onSaveBoard}
        title="La pizarra se guarda sola. Esto actualiza el resumen que usa el brief exportable."
      >
        Actualizar brief
      </button>
    </header>
  );
}
