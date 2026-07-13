import type { BoardScene } from "../boardModel";

type TacticalBoardFooterProps = {
  scenes: BoardScene[];
  currentSceneId: string;
  status: string;
  saveIndicator: string;
  zoom: number;
  onSelectScene: (sceneId: string) => void;
  onAddScene: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onMoveScene: () => void;
  // Playback (W25A): controles de reproduccion de la jugada dibujada. Viven
  // en el footer a proposito — invariante W4, nada flotante sobre el pitch.
  playbackTime: number;
  playbackDuration: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2;
  onPlayPlayback: () => void;
  onPausePlayback: () => void;
  onScrubPlayback: (time: number) => void;
  onTogglePlaybackSpeed: () => void;
};

export function TacticalBoardFooter({
  scenes,
  currentSceneId,
  status,
  saveIndicator,
  zoom,
  onSelectScene,
  onAddScene,
  onZoomOut,
  onZoomIn,
  onMoveScene,
  playbackTime,
  playbackDuration,
  isPlaying,
  playbackSpeed,
  onPlayPlayback,
  onPausePlayback,
  onScrubPlayback,
  onTogglePlaybackSpeed,
}: TacticalBoardFooterProps) {
  const hasPlayback = playbackDuration > 0;
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
      <span className="rombo-board-save-indicator" aria-live="polite">
        {saveIndicator}
      </span>
      {status ? <span className="rombo-board-status">{status}</span> : null}
      {/* W25A: reproduce la jugada dibujada (flechas -> movimiento). Sin
          duracion (escena sin flechas) los controles quedan deshabilitados
          en vez de ocultos — hueco visible, no un salto de layout. */}
      <div
        className="rombo-playback-controls"
        aria-label="Reproduccion de la jugada"
      >
        <button
          type="button"
          className="rombo-playback-toggle"
          disabled={!hasPlayback}
          aria-label={isPlaying ? "Pausar reproduccion" : "Reproducir jugada"}
          onClick={isPlaying ? onPausePlayback : onPlayPlayback}
        >
          {isPlaying ? "Pausa" : "Reproducir"}
        </button>
        <input
          type="range"
          className="rombo-playback-scrub"
          min={0}
          max={hasPlayback ? playbackDuration : 1}
          step={0.01}
          value={hasPlayback ? playbackTime : 0}
          disabled={!hasPlayback}
          aria-label="Progreso de la jugada"
          onChange={(event) => onScrubPlayback(Number(event.target.value))}
        />
        <button
          type="button"
          className="rombo-playback-speed"
          disabled={!hasPlayback}
          aria-label="Velocidad de reproduccion"
          onClick={onTogglePlaybackSpeed}
        >
          {playbackSpeed}×
        </button>
      </div>
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
