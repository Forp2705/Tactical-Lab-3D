type TacticalBoardGhostSceneStateProps = {
  onOpenFirstScene: () => void;
};

// Shown when the board exists but the requested scene id does not match any
// scene in it (e.g. a session block still pointing at a deleted scene). This
// is a distinct state from "no board" — the board is fine, only the specific
// scene reference is stale — so it gets its own message and a single
// recovery action instead of the board-creation CTAs in TacticalBoardEmptyState.
export function TacticalBoardGhostSceneState({
  onOpenFirstScene,
}: TacticalBoardGhostSceneStateProps) {
  return (
    <section className="rombo-board-empty">
      <div>
        <p className="eyebrow">Pizarra tactica</p>
        <h2>La escena solicitada ya no existe</h2>
        <p>
          Esta pizarra sigue disponible, pero la escena que se intento abrir
          fue eliminada o movida. Abri la primera escena para seguir
          trabajando.
        </p>
        <div className="rombo-board-empty-actions">
          <button type="button" className="primary" onClick={onOpenFirstScene}>
            Abrir la primera escena
          </button>
        </div>
      </div>
    </section>
  );
}
