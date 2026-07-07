export function HomeMetrics({
  loadPercentValue,
  loadPeakLabel,
  availablePlayers,
  totalPlayers,
  reportsCount,
  onOpenEvolucion,
  onOpenPostPartido,
}: {
  loadPercentValue: number;
  loadPeakLabel: string;
  availablePlayers: number;
  totalPlayers: number;
  reportsCount: number;
  onOpenEvolucion: () => void;
  onOpenPostPartido: () => void;
}) {
  const hasPlayers = totalPlayers > 0;

  return (
    <section className="home-metrics">
      <div className="home-metric-tile">
        <b className="home-metric-big">
          {hasPlayers ? `${loadPercentValue}%` : "—"}
        </b>
        <small className="home-metric-sub">
          {hasPlayers ? `CARGA PLAN · ${loadPeakLabel}` : "CARGA PLAN"}
        </small>
      </div>
      <button
        type="button"
        className="home-metric-tile home-metric-tile-button"
        onClick={onOpenEvolucion}
        disabled={!hasPlayers}
      >
        <b className="home-metric-big">
          {hasPlayers ? `${availablePlayers}/${totalPlayers}` : "—"}
        </b>
        <small className="home-metric-sub">
          {hasPlayers ? "DISPONIBLES" : "SIN PLANTEL CARGADO"}
        </small>
      </button>
      <button
        type="button"
        className="home-metric-tile home-metric-tile-button"
        onClick={onOpenPostPartido}
      >
        <b className="home-metric-big">
          {String(reportsCount).padStart(2, "0")}
        </b>
        <small className="home-metric-sub">REPORTS GUARDADOS</small>
      </button>
    </section>
  );
}
