import type { OpponentScout } from "@/scout/opponentScout";

const RIVAL_DEFAULTS = new Set(["Proximo rival", "Rival a definir"]);

function resolveRivalLabel(scout: OpponentScout): string {
  const rival = scout.rival.trim();
  if (!rival || RIVAL_DEFAULTS.has(rival)) {
    return "PROXIMO RIVAL A DEFINIR";
  }
  return `VS ${rival.toUpperCase()}`;
}

export function hasRivalGuard(scout: OpponentScout): boolean {
  const rival = scout.rival.trim();
  return Boolean(rival) && !RIVAL_DEFAULTS.has(rival);
}

export function HomeMasthead({
  opponentScout,
  diaFoco,
  objective,
  onOpenScout,
}: {
  opponentScout: OpponentScout;
  diaFoco: string;
  objective: string;
  onOpenScout: () => void;
}) {
  const rivalLabel = resolveRivalLabel(opponentScout);
  const clickable = hasRivalGuard(opponentScout);

  return (
    <div className="home-masthead">
      <div className="home-masthead-anchor" aria-hidden="true" />
      <div className="home-masthead-info">
        {clickable ? (
          <button
            type="button"
            className="home-masthead-rival home-masthead-rival-button"
            onClick={onOpenScout}
          >
            {rivalLabel}
          </button>
        ) : (
          <span className="home-masthead-rival">{rivalLabel}</span>
        )}
        <span className="home-masthead-foco">
          foco de semana: {diaFoco} · {objective}
        </span>
      </div>
    </div>
  );
}
