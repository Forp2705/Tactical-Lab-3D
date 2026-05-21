import { type Layer, catalog } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import { Scene3D } from "@/viewer/Scene3D";
import { useState } from "react";

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
    catalog.find((item) => item.id === focusBlock.exerciseId) ??
    fallbackExercise;

  return (
    <section className="team-card" style={{ maxWidth: 1080, margin: "0 auto" }}>
      <h3>Modo jugador</h3>
      <p className="muted-panel">
        Vista simple para entregar la consigna sin notas del staff ni ruido
        tactico extra.
      </p>
      <div className="canvas-wrap" style={{ height: 420, marginTop: 12 }}>
        <Scene3D
          exercise={focusExercise}
          time={Math.min(1.2, focusExercise.scene.duration)}
          cameraMode="iso"
          showZones={false}
          showRuns
          showPasses
          showPress
          layers={PLAYER_LAYERS}
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
          {focusExercise.coaching.slice(0, 3).map((item, index) => (
            <li key={`${focusExercise.id}-coaching-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => useAppStore.getState().setView("viewer")}
        >
          Volver al visor
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
      </div>
    </section>
  );
}
