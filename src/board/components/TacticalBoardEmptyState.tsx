type TacticalBoardEmptyStateProps = {
  requestedMissing: boolean;
  onCreateFromWeeklyFocus: () => void;
  onCreateBlank: () => void;
};

export function TacticalBoardEmptyState({
  requestedMissing,
  onCreateFromWeeklyFocus,
  onCreateBlank,
}: TacticalBoardEmptyStateProps) {
  return (
    <section className="rombo-board-empty">
      <div>
        <p className="eyebrow">Pizarra tactica</p>
        <h2>
          {requestedMissing
            ? "La pizarra solicitada no existe"
            : "Crear pizarra de planificacion"}
        </h2>
        <p>
          La pizarra convierte un problema tactico en anotaciones y un bloque
          entrenable para tu sesion.
        </p>
        <div className="rombo-board-empty-actions">
          <button
            type="button"
            className="primary"
            onClick={onCreateFromWeeklyFocus}
          >
            Crear desde foco semanal
          </button>
          <button type="button" onClick={onCreateBlank}>
            Nueva pizarra
          </button>
        </div>
      </div>
    </section>
  );
}
