import { useAppStore } from "@/state/useAppStore";

/**
 * Stub for W9 (mc-18): only renders the E8 empty case (no active board, no
 * shape). mc-21 extends this same file to add the board/shape read-only
 * render (priority 1/2 from the acceptance doc); the layout/classes below
 * (`.home-board-panel*`) are the hook for that.
 */
export function HomeTacticalBoardPanel() {
  return (
    <aside className="home-board-panel">
      <div className="home-board-panel-head">
        <span className="panel-eyebrow">TABLERO TACTICO</span>
      </div>
      <div className="home-board-pitch home-board-pitch-empty">
        <svg
          className="home-board-pitch-svg"
          viewBox="0 0 64 100"
          aria-hidden="true"
        >
          <rect
            className="home-board-pitch-outline"
            x="2"
            y="2"
            width="60"
            height="96"
            rx="1.5"
          />
          <line className="home-board-pitch-outline" x1="2" y1="50" x2="62" y2="50" />
          <circle className="home-board-pitch-outline" cx="32" cy="50" r="9" />
          <rect
            className="home-board-pitch-outline"
            x="14"
            y="2"
            width="36"
            height="16"
          />
          <rect
            className="home-board-pitch-outline"
            x="14"
            y="82"
            width="36"
            height="16"
          />
        </svg>
        <p className="home-board-empty-copy">Sin pizarra activa</p>
      </div>
      <button
        type="button"
        className="home-cta-gold home-board-cta"
        onClick={() => {
          useAppStore.getState().createTacticalBoardFromWeeklyFocus();
          useAppStore.getState().setView("board");
        }}
      >
        CREAR PIZARRA
      </button>
    </aside>
  );
}
