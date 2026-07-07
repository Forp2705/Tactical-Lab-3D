export type HomeSessionBlockRow = {
  id: string;
  title: string;
  missing: boolean;
  durationMin: number;
};

export function HomeSessionPaper({
  sessionName,
  blocks,
  totalDuration,
  onOpen,
}: {
  sessionName: string;
  blocks: HomeSessionBlockRow[];
  totalDuration: number;
  onOpen: () => void;
}) {
  const isEmpty = blocks.length === 0;
  const visibleBlocks = blocks.slice(0, 3);
  const remaining = blocks.length - visibleBlocks.length;

  return (
    <article className="home-paper home-paper-session">
      <span className="home-paper-tape" aria-hidden="true" />
      <span className="panel-eyebrow home-paper-eyebrow">
        SESION ACTIVA <span className="mono home-paper-session-name">{sessionName}</span>
      </span>
      <h3 className="home-paper-title home-paper-title-sm">
        {isEmpty ? "SIN SESION ARMADA" : "BLOQUES"}
      </h3>
      {isEmpty ? (
        <p className="home-paper-body">
          Todavia no hay bloques conectados al diagnostico de la semana.
        </p>
      ) : (
        <>
          <ol className="home-paper-blocks">
            {visibleBlocks.map((block, index) => (
              <li key={block.id} className="home-paper-block-row">
                <span className="home-paper-block-index">{index + 1}</span>
                <span
                  className="home-paper-block-title"
                  style={block.missing ? { color: "var(--warn)" } : undefined}
                >
                  {block.missing ? "Ejercicio retirado del catalogo" : block.title}
                </span>
                <span className="chip home-paper-chip">{block.durationMin}'</span>
              </li>
            ))}
            {remaining > 0 ? (
              <li className="home-paper-block-row home-paper-block-more">
                <span className="home-paper-block-title">+{remaining} mas</span>
              </li>
            ) : null}
          </ol>
          <p className="home-paper-footnote">
            {blocks.length} bloques · {totalDuration}' total
          </p>
        </>
      )}
      <button type="button" className="home-paper-link-cta" onClick={onOpen}>
        {isEmpty ? "Armar sesion" : "Abrir sesion"}
      </button>
    </article>
  );
}
