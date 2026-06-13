import { useMemo, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState(0);
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

  function goTo(nextIndex: number) {
    setActiveIndex(Math.max(0, Math.min(blocks.length - 1, nextIndex)));
    setNoteSaved(false);
    setNote("");
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

          {attachedSketch ? (
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
