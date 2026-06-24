import { useMemo, useState } from "react";
import type { TacticalBoard, BoardScene } from "@/board";
import {
  QuickSketchLauncher,
  SketchThumbnail,
  buildContextualSketchDraft,
  buildQuickSketchTitle,
} from "@/sketch";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { readSessionBlockIntent, readSessionIntent } from "./SessionsView";

/**
 * Pitch-side Mode — a low-chrome, coach-readable execution surface for
 * "today's session" on the field. It is intentionally NOT a redesign of
 * SessionsView: it reuses the same session/exercise/sketch/thread data and
 * the existing `readSessionIntent` / `readSessionBlockIntent` derivations,
 * and writes only through existing store actions (`updateSessionBlock`,
 * `addManualObservation`). No new persisted top-level state, no new view id —
 * this is opened as a local overlay from `SessionsView` ("Modo cancha").
 *
 * Scope: session name/date, weekly focus, current block (objective, sketch,
 * coaching points, success signal), prev/next navigation, mark-done toggle,
 * and a quick note saved as a manual observation (source "home", same as the
 * staff capture on Home/Sala).
 */
export function PitchSideView({ onExit }: { onExit: () => void }) {
  const session = useAppStore((state) => state.session);
  const aiPrompt = useAppStore((state) => state.aiPrompt);
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const sketches = useAppStore((state) => state.sketches);
  const tacticalBoards = useAppStore((state) => state.tacticalBoards);
  const [activeIndex, setActiveIndex] = useState(0);
  const [boardSceneIndex, setBoardSceneIndex] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const sessionIntent = useMemo(
    () => readSessionIntent(session.staffNotes, aiPrompt, weeklyDecisionThread),
    [session.staffNotes, aiPrompt, weeklyDecisionThread],
  );

  const blocks = session.blocks;
  const safeIndex = blocks.length ? Math.min(activeIndex, blocks.length - 1) : 0;
  const block = blocks[safeIndex] ?? null;
  const exercise = block ? getExerciseById(block.exerciseId) : null;
  const blockIntent =
    block && exercise
      ? readSessionBlockIntent(block.notes, exercise, aiPrompt, weeklyDecisionThread)
      : null;
  const attachedSketch =
    block?.sketchId ? sketches.find((entry) => entry.id === block.sketchId) ?? null : null;
  const attachedBoard =
    block?.boardId ? tacticalBoards.find((entry) => entry.id === block.boardId) ?? null : null;
  const resolvedBoardScene = resolvePitchSideBoardScene(attachedBoard, block?.boardSceneId, boardSceneIndex);
  const attachedBoardScene = resolvedBoardScene.scene;

  function goTo(nextIndex: number) {
    setActiveIndex(Math.max(0, Math.min(blocks.length - 1, nextIndex)));
    setNoteSaved(false);
    setNote("");
    setBoardSceneIndex(null);
  }

  function toggleDone() {
    if (!block) return;
    useAppStore.getState().updateSessionBlock(block.id, { done: !block.done });
  }

  function saveNote() {
    const text = note.trim();
    if (!text) return;
    const tagged = exercise ? `Modo cancha - ${exercise.title}: ${text}` : `Modo cancha: ${text}`;
    const observationId = useAppStore.getState().addManualObservation({
      text: tagged,
      source: "home",
    });
    if (observationId) {
      setNote("");
      setNoteSaved(true);
    }
  }

  return (
    <section className="pitch-side-view">
      <header className="pitch-side-header">
        <div>
          <span className="eyebrow">Modo cancha</span>
          <h2>{session.name?.trim() || "Sesion de hoy"}</h2>
          {session.date ? <p className="muted">{session.date}</p> : null}
        </div>
        <button type="button" className="btn ghost" onClick={onExit}>
          Volver a la sesion completa
        </button>
      </header>

      <div className="pitch-side-focus">
        <span className="eyebrow">Foco semanal</span>
        <p>{sessionIntent.problem}</p>
        <small className="muted">
          Hoy: {blockIntent?.objective ?? "Cargar un bloque para salir a cancha."}
        </small>
      </div>

      {block && exercise && blockIntent ? (
        <article className="pitch-side-card">
          <div className="pitch-side-card-head">
            <span className="eyebrow">
              Ejercicio actual - {safeIndex + 1} de {blocks.length}
            </span>
            <h3>{exercise.title}</h3>
            <p className="muted">
              {block.durationMin}' - {blockIntent.objective}
            </p>
          </div>

          {attachedBoard && attachedBoardScene ? (
            <PitchSideBoardCard
              board={attachedBoard}
              scene={attachedBoardScene}
              sceneIndex={resolvedBoardScene.index}
              missingLinkedScene={resolvedBoardScene.missingLinkedScene}
              onPrevious={() => setBoardSceneIndex(Math.max(0, resolvedBoardScene.index - 1))}
              onNext={() => setBoardSceneIndex(Math.min(attachedBoard.scenes.length - 1, resolvedBoardScene.index + 1))}
            />
          ) : attachedSketch ? (
            <SketchThumbnail sketch={attachedSketch} className="pitch-side-sketch-thumb" />
          ) : (
            <div className="muted-panel">
              <p style={{ marginTop: 0 }}>
                Este bloque todavia no tiene un boceto adjunto.
              </p>
              <QuickSketchLauncher
                buttonClassName="secondary"
                buttonLabel="Crear boceto rapido"
                panelTitle="Boceto rapido para modo cancha"
                buildDraft={() =>
                  buildContextualSketchDraft({
                    title: buildQuickSketchTitle([
                      "Boceto",
                      exercise.title,
                      sessionIntent.problem,
                    ]),
                    tacticalFocus: blockIntent.objective,
                    sourceLabel: `Modo cancha bloque ${safeIndex + 1}`,
                  })
                }
                onSaveSuccess={(sketchId) =>
                  useAppStore.getState().attachSketchToSessionBlock(block.id, sketchId)
                }
              />
            </div>
          )}

          <div className="pitch-side-detail">
            <span>Puntos de coaching</span>
            {exercise.coaching.length ? (
              <ul>
                {exercise.coaching.slice(0, 5).map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin puntos de coaching cargados para este ejercicio.</p>
            )}
          </div>

          <div className="pitch-side-detail">
            <span>Senal de mejora</span>
            <p>{blockIntent.successSignal}</p>
          </div>

          <div className="toolbar compact pitch-side-nav">
            <button
              type="button"
              className="secondary"
              onClick={() => goTo(safeIndex - 1)}
              disabled={safeIndex === 0}
            >
              Ejercicio anterior
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => goTo(safeIndex + 1)}
              disabled={safeIndex >= blocks.length - 1}
            >
              Siguiente ejercicio
            </button>
            <button
              type="button"
              className={block.done ? "btn primary" : "btn ghost"}
              onClick={toggleDone}
            >
              {block.done ? "Realizado" : "Marcar realizado"}
            </button>
            {(block.done || noteSaved) && safeIndex < blocks.length - 1 ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => goTo(safeIndex + 1)}
              >
                Ir al siguiente ejercicio
              </button>
            ) : null}
          </div>

          <div className="pitch-side-note">
            <label>
              <span>Anotar observacion</span>
              <textarea
                className="quick-observation-input"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteSaved(false);
                }}
                placeholder='Ej: "El grupo B no sostiene la presion en el segundo bloque"'
              />
            </label>
            <div className="toolbar compact">
              <button type="button" className="btn primary" disabled={!note.trim()} onClick={saveNote}>
                Guardar nota
              </button>
              {noteSaved ? (
                <span className="muted">Guardada como observacion manual del staff.</span>
              ) : null}
            </div>
          </div>
        </article>
      ) : (
        <p className="muted-panel">
          Esta sesion todavia no tiene ejercicios cargados. Volve a la sesion
          completa para arrastrar el primero desde la biblioteca.
        </p>
      )}
    </section>
  );
}

export function resolvePitchSideBoardScene(
  board: TacticalBoard | null,
  linkedSceneId: string | undefined,
  overrideIndex: number | null,
) {
  if (!board?.scenes.length) {
    return { scene: null as BoardScene | null, index: 0, missingLinkedScene: false };
  }
  const linkedIndex = linkedSceneId
    ? board.scenes.findIndex((scene) => scene.id === linkedSceneId)
    : -1;
  const requestedIndex = overrideIndex ?? (linkedIndex >= 0 ? linkedIndex : 0);
  const index = Math.max(0, Math.min(board.scenes.length - 1, requestedIndex));
  return {
    scene: board.scenes[index] ?? null,
    index,
    missingLinkedScene: Boolean(linkedSceneId && linkedIndex < 0),
  };
}

function PitchSideBoardCard({
  board,
  scene,
  sceneIndex,
  missingLinkedScene,
  onPrevious,
  onNext,
}: {
  board: TacticalBoard;
  scene: BoardScene;
  sceneIndex: number;
  missingLinkedScene: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const playerInstructions = [...board.instructions, ...scene.instructions]
    .filter((instruction) => instruction.visibility === "player" || instruction.visibility === "export")
    .slice(0, 4);
  return (
    <div className="pitch-side-board-card">
      <div className="pitch-side-card-head">
        <span className="eyebrow">
          Pizarra tactica - escena {sceneIndex + 1} de {board.scenes.length}
        </span>
        <h3>{scene.title}</h3>
        <p className="muted">{board.title} - {scene.phaseLabel}</p>
        {missingLinkedScene ? (
          <p className="muted">La escena vinculada ya no existe. Mostrando una escena disponible.</p>
        ) : null}
      </div>
      <PitchSideBoardSvg board={board} scene={scene} />
      <div className="pitch-side-detail">
        <span>Brief jugadores</span>
        {playerInstructions.length ? (
          <ul>
            {playerInstructions.map((instruction) => (
              <li key={instruction.id}>{instruction.text}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sin instrucciones visibles para jugadores.</p>
        )}
      </div>
      <div className="toolbar compact pitch-side-nav">
        <button type="button" className="secondary" onClick={onPrevious} disabled={sceneIndex <= 0}>
          Escena anterior
        </button>
        <button type="button" className="secondary" onClick={onNext} disabled={sceneIndex >= board.scenes.length - 1}>
          Siguiente escena
        </button>
      </div>
    </div>
  );
}

function PitchSideBoardSvg({ board, scene }: { board: TacticalBoard; scene: BoardScene }) {
  return (
    <svg className="pitch-side-board-svg" viewBox="0 0 100 64" role="img" aria-label={`${board.title} - ${scene.title}`}>
      <defs>
        <marker id="pitch-side-arrowhead" markerWidth="7" markerHeight="7" refX="5.6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#5eead4" />
        </marker>
      </defs>
      <rect width="100" height="64" rx="1.4" fill="#071b14" />
      <g fill="none" stroke="rgba(229,255,247,.45)" strokeWidth=".4">
        <rect x="2" y="2" width="96" height="60" />
        <line x1="50" y1="2" x2="50" y2="62" />
        <circle cx="50" cy="32" r="7.5" />
        <rect x="2" y="20" width="12" height="24" />
        <rect x="86" y="20" width="12" height="24" />
      </g>
      {scene.zones
        .filter((zone) => zone.visibility === "player" || zone.visibility === "export")
        .map((zone) => (
          <rect
            key={zone.id}
            x={zone.x}
            y={(zone.y / 100) * 64}
            width={zone.w}
            height={(zone.h / 100) * 64}
            rx="1"
            fill={`${zone.color}33`}
            stroke={zone.color}
            strokeWidth=".5"
          />
        ))}
      {scene.arrows
        .filter((arrow) => arrow.visibility === "player" || arrow.visibility === "export")
        .map((arrow) => {
          const fromEndpoint = arrow.from;
          const toEndpoint = arrow.to;
          const from = fromEndpoint.kind === "point"
            ? fromEndpoint.point
            : scene.objects.find((object) => object.id === fromEndpoint.objectId)?.position;
          const to = toEndpoint.kind === "point"
            ? toEndpoint.point
            : scene.objects.find((object) => object.id === toEndpoint.objectId)?.position;
          if (!from || !to) return null;
          return (
            <line
              key={arrow.id}
              x1={from.x}
              y1={(from.y / 100) * 64}
              x2={to.x}
              y2={(to.y / 100) * 64}
              stroke={arrow.semantic === "pressure" ? "#ff7474" : "#5eead4"}
              strokeWidth=".8"
              markerEnd="url(#pitch-side-arrowhead)"
            />
          );
        })}
      {scene.objects
        .filter((object) => object.visibility === "player" || object.visibility === "export" || object.type === "ball")
        .map((object) => (
          <g key={object.id} transform={`translate(${object.position.x} ${(object.position.y / 100) * 64})`}>
            <circle
              r={object.type === "ball" ? 1.4 : 2.8}
              fill={object.type === "opponentToken" ? "#ff7474" : object.type === "ball" ? "#ffffff" : "#5eead4"}
            />
            {object.type !== "ball" ? (
              <text y=".8" textAnchor="middle" fontSize="2.2" fill="#061018" fontWeight="700">
                {object.number ?? object.role ?? object.label}
              </text>
            ) : null}
          </g>
        ))}
    </svg>
  );
}
