import type { SessionBlock } from "@/data";
import type { ScenarioId } from "@/ai/scenarioSimulator";
import { blockTitle } from "../boardGeometry";
import type { BoardPayload, PlanningBoardLayer } from "../productBoardTypes";
import type { ConsequenceOverlay } from "../scenarioBoardConsequence";
import { groundingSummary } from "@/board/scenarioGrounding";

type TacticalBoardAiPanelProps = {
  aiInterpretation: string[];
  layers: PlanningBoardLayer[];
  payload: BoardPayload | null;
  attachBlockId: string;
  sessionBlocks: SessionBlock[];
  canDeleteScene: boolean;
  consequenceOverlay: ConsequenceOverlay | null;
  onRunScenario: (scenarioId: ScenarioId) => void;
  onCommitOverlay: () => void;
  onDiscardOverlay: () => void;
  onToggleLayer: (layerId: string) => void;
  onExportPayload: () => void;
  onExportImage: () => void;
  onExportBrief: (audience: "player" | "staff") => void;
  onDuplicateScene: () => void;
  onDeleteCurrentScene: () => void;
  onAttachBlockIdChange: (blockId: string) => void;
  onAttachToBlock: () => void;
  onCreateSessionBlock: () => void;
};

export function TacticalBoardAiPanel({
  aiInterpretation,
  layers,
  payload,
  attachBlockId,
  sessionBlocks,
  canDeleteScene,
  consequenceOverlay,
  onRunScenario,
  onCommitOverlay,
  onDiscardOverlay,
  onToggleLayer,
  onExportPayload,
  onExportImage,
  onExportBrief,
  onDuplicateScene,
  onDeleteCurrentScene,
  onAttachBlockIdChange,
  onAttachToBlock,
  onCreateSessionBlock,
}: TacticalBoardAiPanelProps) {
  return (
    <>
      <section>
        {/* La lectura del board es lo principal del panel: que ENTIENDE RomboIQ
            de la escena, no un payload para alimentar un generador. */}
        <h2>Que entiende RomboIQ</h2>
        <ul className="rombo-ai-list">
          {aiInterpretation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rombo-scenario">
        {/* El DT plantea una situacion y elige un ajuste; RomboIQ proyecta la
            consecuencia deterministica de vuelta al board (overlay efimera). */}
        <h2>Probar un ajuste</h2>
        <button
          type="button"
          className="rombo-scenario-run"
          onClick={() => onRunScenario("raise-block")}
        >
          Subir el bloque
        </button>

        {consequenceOverlay ? (
          <div className="rombo-scenario-readout">
            <p className="rombo-scenario-benefit">
              {consequenceOverlay.readout.expectedBenefit}
            </p>
            <p className="rombo-scenario-risk">
              {consequenceOverlay.readout.mainRisk}
            </p>
            <p className="rombo-scenario-evidence">
              Confianza: {consequenceOverlay.readout.confidence} · Evidencia:{" "}
              {consequenceOverlay.readout.evidenceLevel}
            </p>
            {consequenceOverlay.readout.tacticalRows.length > 0 ? (
              <ul className="rombo-scenario-grounding">
                {consequenceOverlay.readout.tacticalRows.map((row) => (
                  <li key={`${row.kind}:${row.label}`}>
                    {row.kind === "superiority"
                      ? row.populated
                        ? `${row.label}: ${row.own} propios vs ${row.rival} rival (${row.delta >= 0 ? "+" : ""}${row.delta})`
                        : `${row.label}: sin fichas en la zona`
                      : `${row.label}: ${row.covering} cobertura${row.covering === 1 ? "" : "s"}`}
                  </li>
                ))}
              </ul>
            ) : null}
            {(() => {
              const summary = groundingSummary(consequenceOverlay.readout.grounding);
              return summary ? (
                <p className="rombo-scenario-partial">{summary}</p>
              ) : null;
            })()}
            {consequenceOverlay.rivalFacts.length > 0 ? (
              <ul className="rombo-scenario-rival">
                {consequenceOverlay.rivalFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            ) : null}
            {consequenceOverlay.notes.length > 0 ? (
              <ul className="rombo-scenario-notes">
                {consequenceOverlay.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <div className="rombo-scenario-actions">
              <button type="button" onClick={onCommitOverlay}>
                Aceptar
              </button>
              <button type="button" onClick={onDiscardOverlay}>
                Descartar
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <h2>Capas / vistas</h2>
        <div className="rombo-layer-list">
          {layers.map((layer) => (
            <label key={layer.id}>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggleLayer(layer.id)}
              />
              {layer.name}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2>Acciones</h2>
        <button
          type="button"
          className="rombo-primary-cta compact"
          onClick={onCreateSessionBlock}
        >
          Llevar al entrenamiento
        </button>
        <button type="button" onClick={onDuplicateScene}>
          Duplicar escena
        </button>
        <button
          type="button"
          onClick={onDeleteCurrentScene}
          disabled={!canDeleteScene}
        >
          Eliminar escena
        </button>
        <select
          value={attachBlockId}
          onChange={(event) => onAttachBlockIdChange(event.target.value)}
        >
          <option value="">Vincular a bloque...</option>
          {sessionBlocks.map((block, index) => (
            <option key={block.id} value={block.id}>
              {index + 1}. {blockTitle(block)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAttachToBlock}
          disabled={!attachBlockId}
        >
          Vincular escena
        </button>
      </section>

      {/* Exports y payload JSON viven internamente, no dominan el panel. Los
          handlers siguen funcionando, solo dejan de ser prominentes. */}
      <details className="rombo-advanced">
        <summary>Avanzado</summary>
        <button type="button" onClick={onExportImage}>
          Exportar imagen
        </button>
        <button type="button" onClick={() => onExportBrief("staff")}>
          Exportar brief imprimible
        </button>
        <button type="button" onClick={() => onExportBrief("player")}>
          Brief jugadores
        </button>
        <button type="button" onClick={onExportPayload}>
          Exportar payload (JSON)
        </button>
        {payload ? (
          <section className="rombo-payload">
            <h2>Payload listo</h2>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </section>
        ) : null}
      </details>
    </>
  );
}
