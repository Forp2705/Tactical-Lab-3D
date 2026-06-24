import { type Layer, catalog } from "@/data";
import { exportWeeklyBriefingHtml } from "@/export/premiumExports";
import {
  QuickSketchLauncher,
  SketchThumbnail,
  buildContextualSketchDraft,
  buildQuickSketchTitle,
} from "@/sketch";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { WeeklyDecisionCard, buildWeeklyDecisionCardModel } from "@/ui/WeeklyDecisionCard";
import { Scene3D } from "@/viewer/Scene3D";
import { getMatchFrame } from "@/viewer/lib/matchEngine";
import { readSessionBlockIntent, readSessionIntent } from "@/sessions/SessionsView";
import { useMemo, useState } from "react";

const PLAYER_LAYERS: Record<Layer, boolean> = {
  withBall: true,
  withoutBall: true,
  press: true,
  cover: true,
  altA: false,
  altB: false,
  rival: true,
  abp: true,
  notes: false,
};

export function PlayerView() {
  const session = useAppStore((state) => state.session);
  const teamName = useAppStore((state) => state.team.name);
  const aiPrompt = useAppStore((state) => state.aiPrompt);
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const sketches = useAppStore((state) => state.sketches);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const fallbackExercise =
    catalog.find((item) => item.id === selectedExerciseId) ?? catalog[0];
  const [blockIndex, setBlockIndex] = useState(0);
  const blocks = session.blocks.length
    ? session.blocks
    : [
        {
          id: "fallback",
          exerciseId: fallbackExercise.id,
          durationMin: fallbackExercise.duration,
          swappable: false,
        },
      ];
  const safeIndex = Math.min(blockIndex, blocks.length - 1);
  const focusBlock = blocks[safeIndex];
  const focusExercise =
    getExerciseById(focusBlock.exerciseId) ?? fallbackExercise;
  const sessionIntent = useMemo(
    () => readSessionIntent(session.staffNotes, aiPrompt, weeklyDecisionThread),
    [aiPrompt, session.staffNotes, weeklyDecisionThread],
  );
  const blockIntent = useMemo(
    () =>
      readSessionBlockIntent(
        focusBlock.notes,
        focusExercise,
        aiPrompt,
        weeklyDecisionThread,
      ),
    [aiPrompt, focusBlock.notes, focusExercise, weeklyDecisionThread],
  );
  const attachedSketch = focusBlock.sketchId
    ? sketches.find((entry) => entry.id === focusBlock.sketchId) ?? null
    : null;
  const weeklyDecisionCard = useMemo(
    () => buildWeeklyDecisionCardModel({ thread: weeklyDecisionThread }),
    [weeklyDecisionThread],
  );
  // Preview estatico: el frame se computa aca y se inyecta a Scene3D (mismo
  // contrato de prop que el viewer principal tras el dedup de getMatchFrame).
  const previewTime = Math.min(1.2, focusExercise.scene.duration);
  const previewFrame = useMemo(
    () => getMatchFrame(focusExercise, previewTime, { personalSpace: false }),
    [focusExercise, previewTime],
  );

  return (
    <section className="team-card" style={{ maxWidth: 1080, margin: "0 auto" }}>
      <h3>Modo jugador</h3>
      <p className="muted-panel">
        Vista simple para entregar la consigna sin notas del staff ni ruido
        tactico extra.
      </p>
      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div className="stat-box">
          <b>Foco semanal</b>
          {sessionIntent.problem}
        </div>
        <div className="stat-box">
          <b>Objetivo de hoy</b>
          {blockIntent.objective}
        </div>
      </div>
      <div className="canvas-wrap" style={{ height: 420, marginTop: 12 }}>
        <Scene3D
          exercise={focusExercise}
          time={previewTime}
          cameraMode="iso"
          showZones={false}
          showRuns
          showPasses
          showPress
          layers={PLAYER_LAYERS}
          frame={previewFrame}
        />
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="secondary"
          disabled={safeIndex === 0}
          onClick={() => setBlockIndex((current) => Math.max(0, current - 1))}
        >
          Anterior
        </button>
        <span>
          Bloque {safeIndex + 1} / {blocks.length}
        </span>
        <button
          type="button"
          className="secondary"
          disabled={safeIndex >= blocks.length - 1}
          onClick={() =>
            setBlockIndex((current) => Math.min(blocks.length - 1, current + 1))
          }
        >
          Siguiente
        </button>
      </div>
      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div className="stat-box">
          <b>Ejercicio</b>
          {focusExercise.title}
        </div>
        <div className="stat-box">
          <b>Objetivo</b>
          {focusExercise.objective.primary}
        </div>
        <div className="stat-box">
          <b>Duracion</b>
          {focusBlock.durationMin} min
        </div>
        <div className="stat-box">
          <b>Jugadores</b>
          {focusExercise.players.min}-{focusExercise.players.max}
        </div>
      </div>
      <div className="team-card" style={{ marginTop: 12 }}>
        <h3>Que miramos</h3>
        <ul>
          {[blockIntent.successSignal, ...focusExercise.coaching].slice(0, 3).map((item, index) => (
            <li key={`${focusExercise.id}-coaching-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
      {attachedSketch ? (
        <div className="team-card" style={{ marginTop: 12 }}>
          <h3>Boceto adjunto</h3>
          <SketchThumbnail sketch={attachedSketch} />
        </div>
      ) : null}
      <div className="toolbar" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <QuickSketchLauncher
          buttonClassName="secondary"
          buttonLabel="Boceto rapido"
          buttonTitle="Crear un boceto rapido para el briefing actual"
          panelTitle="Boceto rapido para briefing"
          buildDraft={() =>
            buildContextualSketchDraft({
              title: buildQuickSketchTitle([
                "Boceto",
                focusExercise.title,
                sessionIntent.problem,
              ]),
              tacticalFocus: blockIntent.objective,
              sourceLabel: `Bloque ${safeIndex + 1}`,
            })
          }
          onSaveSuccess={(sketchId) =>
            useAppStore.getState().attachSketchToSessionBlock(focusBlock.id, sketchId)
          }
        />
        <button
          type="button"
          onClick={() => {
            if (!weeklyDecisionCard) return;
            exportWeeklyBriefingHtml({
              teamName: teamName.trim() || "Equipo",
              session,
              decision: weeklyDecisionCard,
              sketch: attachedSketch,
              coachingPoints: [blockIntent.objective, ...focusExercise.coaching],
              reminders: [
                blockIntent.successSignal,
                blockIntent.nextReview,
                weeklyDecisionCard.whatIsMissing,
              ],
            });
          }}
        >
          Compartir briefing
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
      <WeeklyDecisionCard
        model={weeklyDecisionCard}
        title="Resumen para staff/plantel"
        detailsLabel="Usalo como briefing corto antes de cancha o partido."
      />
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => useAppStore.getState().setView("viewer")}
        >
          Volver al visor
        </button>
      </div>
    </section>
  );
}
