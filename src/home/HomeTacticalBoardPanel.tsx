import { useAppStore } from "@/state/useAppStore";
import { useMemo } from "react";
import {
  deriveHomeBoardPreview,
  type HomeBoardPreviewToken,
} from "./homeBoardPreview";

/**
 * E8 (mc-21): panel TABLERO TACTICO de Sala. Render estrictamente read-only
 * (SVG local, cero imports del editor de Pizarra): board activo > shape mas
 * reciente de LineupLab > vacio. La derivacion vive en homeBoardPreview.ts
 * (pura y testeada); aca solo se escala 0-100 -> viewBox y se pintan fichas.
 */

const FIELD_X = 2;
const FIELD_Y = 2;
const FIELD_W = 60;
const FIELD_H = 96;

function sx(x: number) {
  return FIELD_X + (x / 100) * FIELD_W;
}

function sy(y: number) {
  return FIELD_Y + (y / 100) * FIELD_H;
}

export function HomeTacticalBoardPanel() {
  const tacticalBoards = useAppStore((state) => state.tacticalBoards);
  const activeBoardId = useAppStore((state) => state.activeBoardId);
  const activeBoardSceneId = useAppStore((state) => state.activeBoardSceneId);
  const shapes = useAppStore((state) => state.lineupLab.shapes);
  const players = useAppStore((state) => state.team.players);

  const preview = useMemo(
    () =>
      deriveHomeBoardPreview({
        tacticalBoards,
        activeBoardId,
        activeBoardSceneId,
        shapes,
        players,
      }),
    [tacticalBoards, activeBoardId, activeBoardSceneId, shapes, players],
  );

  const hasBoard = preview.kind === "board";
  const chip = preview.kind === "empty" ? null : preview.chip;
  const tokens = preview.kind === "empty" ? [] : preview.tokens;
  const ball = preview.kind === "board" ? preview.ball : null;

  return (
    <aside className="home-board-panel">
      <div className="home-board-panel-head">
        <span className="panel-eyebrow">TABLERO TACTICO</span>
        {chip ? (
          <span className="home-board-chip" title={chip}>
            {chip}
          </span>
        ) : null}
      </div>
      <div
        className={`home-board-pitch${preview.kind === "empty" ? " home-board-pitch-empty" : ""}`}
      >
        <svg
          className="home-board-pitch-svg"
          viewBox="0 0 64 100"
          role="img"
          aria-label={
            preview.kind === "empty"
              ? "Tablero sin pizarra activa"
              : `Tablero: ${chip}`
          }
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
          {tokens.map((token) => (
            <BoardToken key={token.id} token={token} />
          ))}
          {ball ? (
            <circle
              className="home-board-ball"
              cx={sx(ball.x)}
              cy={sy(ball.y)}
              r="1.2"
            />
          ) : null}
        </svg>
        {preview.kind === "empty" ? (
          <p className="home-board-empty-copy">Sin pizarra activa</p>
        ) : null}
      </div>
      <button
        type="button"
        className="home-cta-gold home-board-cta"
        onClick={() => {
          const store = useAppStore.getState();
          if (!hasBoard) store.createTacticalBoardFromWeeklyFocus();
          store.setView("board");
        }}
      >
        {hasBoard ? "ABRIR PIZARRA" : "CREAR PIZARRA"}
      </button>
    </aside>
  );
}

function BoardToken({ token }: { token: HomeBoardPreviewToken }) {
  const cx = sx(token.x);
  const cy = sy(token.y);
  if (token.team === "B") {
    return <circle className="home-board-token-b" cx={cx} cy={cy} r="2.4" />;
  }
  return (
    <g>
      <circle className="home-board-token-a" cx={cx} cy={cy} r="2.7" />
      {token.number != null ? (
        <text className="home-board-token-num" x={cx} y={cy}>
          {token.number}
        </text>
      ) : null}
      {token.role ? (
        <text className="home-board-token-role" x={cx} y={cy + 4.6}>
          {token.role.slice(0, 3).toUpperCase()}
        </text>
      ) : null}
    </g>
  );
}
