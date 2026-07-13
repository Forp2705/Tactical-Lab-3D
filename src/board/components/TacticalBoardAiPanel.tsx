import type { SessionBlock } from "@/data";
import type { ScenarioId } from "@/ai/scenarioSimulator";
import { blockTitle } from "../boardGeometry";
import type { BoardPayload, PlanningBoardLayer } from "../productBoardTypes";
import type { ConsequenceOverlay } from "../scenarioBoardConsequence";
import type { TacticalRead } from "../boardTacticalRead";
import type { GrammarWarning } from "../boardTacticalGrammar";
import { groundingSummary } from "@/board/scenarioGrounding";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { BoardFreeStateEvidencePacket } from "@/board/boardFreeStateEvidencePacket";
import type { CoachResponse } from "@/ai/CoachSchemas";
import { renderableBoardFacts, renderableFreeStateFacts } from "@/board/boardFactPresentation";

type TacticalBoardAiPanelProps = {
  aiInterpretation: Array<{ id: string; text: string }>;
  // Reactive board engine (mc-21): deterministic geometric reads, live via
  // useMemo(scene) — same reactivity aiInterpretation already has. Chips
  // only; the canvas overlay is driven separately (see tacticalOverlay on
  // TacticalBoardCanvas), pointerup-gated.
  tacticalReads: TacticalRead[];
  // W24A H2: distingue "el motor no tiene con que medir" (ningun token propio
  // con rol asignado) de "midio y quedo mudo porque esta equilibrado" — solo
  // el primer caso amerita un estado vacio explicito (ver render abajo).
  hasAnyOwnRoleAssigned: boolean;
  // Gramatica tactica (W25B): warnings vigentes de la escena actual (auditScene),
  // recalculadas en el mismo ciclo que tacticalReads. El bloqueo duro no pasa
  // por aca — ese feedback sale por el status del footer en el commit del gesto.
  grammarWarnings: GrammarWarning[];
  layers: PlanningBoardLayer[];
  payload: BoardPayload | null;
  attachBlockId: string;
  sessionBlocks: SessionBlock[];
  canDeleteScene: boolean;
  consequenceOverlay: ConsequenceOverlay | null;
  coachLoading: boolean;
  coachError: string | null;
  coachAnswer: { response: CoachResponse; packet: BoardEvidencePacket } | null;
  // Free-state bridge (mc-21 w2 B): always available, independent of the
  // canned-scenario flow above. freeStateSummary is what we are ABOUT TO
  // SEND, shown before asking — transparency over what leaves the board.
  freeStateSummary: Array<{ id: string; text: string }>;
  freeStateCoachLoading: boolean;
  freeStateCoachError: string | null;
  freeStateCoachAnswer: {
    response: CoachResponse;
    packet: BoardFreeStateEvidencePacket;
  } | null;
  onRunScenario: (scenarioId: ScenarioId) => void;
  onAskCoach: () => void;
  onAskCoachFreeState: () => void;
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
  tacticalReads,
  hasAnyOwnRoleAssigned,
  grammarWarnings,
  layers,
  payload,
  attachBlockId,
  sessionBlocks,
  canDeleteScene,
  consequenceOverlay,
  coachLoading,
  coachError,
  coachAnswer,
  freeStateSummary,
  freeStateCoachLoading,
  freeStateCoachError,
  freeStateCoachAnswer,
  onRunScenario,
  onAskCoach,
  onAskCoachFreeState,
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
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
        {/* Lecturas geometricas deterministicas (mc-21): mismo hogar textual,
            hecho medido con su graduacion honesta (nunca intencion). Ausencia
            de chips = forma equilibrada o datos insuficientes, informacion
            valida por si misma (no se rellena con avisos vacios). */}
        {tacticalReads.length > 0 ? (
          <div className="rombo-tactical-reads">
            {tacticalReads.map((read) => (
              <span
                key={read.id}
                className={`rombo-tactical-chip rombo-tactical-chip-${read.confidence}`}
              >
                {read.text}
              </span>
            ))}
          </div>
        ) : hasAnyOwnRoleAssigned ? null : (
          // W24A H2: explica el silencio SOLO cuando la causa es falta de
          // dato (ningun token propio con rol) — nunca cuando el motor midio
          // y decidio callarse por equilibrio (ese silencio sigue mudo,
          // doctrina intocable).
          <p className="rombo-tactical-reads-empty">
            Sin lectura: asigna roles (LB, RB, CB...) a los tokens propios
            para que RomboIQ pueda medir.
          </p>
        )}
        {/* Gramatica tactica (W25B): advertencias vigentes de la escena
            (acumulacion, saturacion de un token, mezcla ofensiva/defensiva).
            Nunca bloquean nada aca — lo imposible ya se rechazo en el commit
            del gesto (ver status del footer); esto es solo lo dudoso. */}
        {grammarWarnings.length > 0 ? (
          <div className="rombo-grammar-warnings">
            {grammarWarnings.map((warning) => (
              <span key={warning.id} className="rombo-grammar-warning-chip">
                {warning.text}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rombo-freestate-coach">
        {/* Puente board->coach sobre el ESTADO LIBRE de la escena (mc-21 w2 B):
            disponible SIEMPRE, no solo dentro de un ajuste de escenario. El
            resumen se muestra ANTES de preguntar (que se manda), y solo lleva
            hechos contables/declarados — nada inferido. */}
        <h2>Consultar sobre la escena actual</h2>
        {freeStateSummary.length > 0 ? (
          <ul className="rombo-freestate-summary">
            {freeStateSummary.map((row) => (
              <li key={row.id}>{row.text}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="rombo-freestate-ask-coach"
          onClick={onAskCoachFreeState}
          disabled={freeStateCoachLoading}
        >
          {freeStateCoachLoading
            ? "Consultando al coach..."
            : "Consultar al coach sobre esta escena"}
        </button>
        {freeStateCoachError ? (
          <p className="rombo-freestate-coach-error" role="alert">
            {freeStateCoachError}
          </p>
        ) : null}
        {freeStateCoachAnswer ? (
          <div className="rombo-freestate-coach-answer">
            {/* Misma doctrina render-from-structure que el flujo de escenario:
                las filas de hechos vienen SOLO de renderableFreeStateFacts. */}
            {freeStateCoachAnswer.response.mode !== "question"
              ? (() => {
                  const facts = renderableFreeStateFacts(
                    freeStateCoachAnswer.packet,
                    freeStateCoachAnswer.response.advice.supportingFacts,
                  );
                  return facts.length > 0 ? (
                    <ul className="rombo-freestate-board-facts">
                      {facts.map((fact) => (
                        <li key={fact.id}>{fact.text}</li>
                      ))}
                    </ul>
                  ) : null;
                })()
              : null}
            {freeStateCoachAnswer.response.mode === "question" ? (
              // mc-99 REVISE (gate task_2ee644e07e2a): question-mode used to
              // dump the raw response via JSON.stringify in a <pre> here —
              // debug-console UI on a DT-facing surface. This button has no
              // diagnostic evidence behind it (generic "que te parece"
              // input, and the free-state packet deliberately never counts
              // as diagnosis evidence), so question mode is the LIKELY path,
              // not an edge case — render the coach's actual questions
              // instead. The scenario-flow twin below still does the raw
              // dump; that is preexisting, registered debt, not touched here.
              <ul className="rombo-freestate-coach-questions">
                {freeStateCoachAnswer.response.selectedQuestions.map((q) => (
                  <li key={q.id}>
                    <p className="rombo-freestate-coach-question-text">
                      {q.question}
                    </p>
                    {q.whyItMatters ? (
                      <p className="rombo-freestate-coach-question-why">
                        {q.whyItMatters}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <pre className="rombo-freestate-coach-prose">
                {freeStateCoachAnswer.response.advice.tacticalReading}
              </pre>
            )}
          </div>
        ) : null}
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

            {/* Puente al coach: manda este ajuste (paquete estructurado, one-shot)
                via /api. Render rico de la respuesta es Task 7; aca el estado es
                honesto y minimo (cargando / error / placeholder de respuesta). */}
            <div className="rombo-scenario-coach">
              <button
                type="button"
                className="rombo-scenario-ask-coach"
                onClick={onAskCoach}
                disabled={coachLoading}
              >
                {coachLoading
                  ? "Consultando al coach..."
                  : "Consultar al coach sobre este ajuste"}
              </button>
              {coachError ? (
                <p className="rombo-scenario-coach-error" role="alert">
                  {coachError}
                </p>
              ) : null}
              {coachAnswer ? (
                <div className="rombo-scenario-coach-answer">
                  {/* Board-fact rows come ONLY from the authoritative packet claims
                      via renderableBoardFacts — never from coach prose. Question
                      mode has no supportingFacts, so no board-fact rows render. */}
                  {coachAnswer.response.mode !== "question"
                    ? (() => {
                        const facts = renderableBoardFacts(
                          coachAnswer.packet,
                          coachAnswer.response.advice.supportingFacts,
                        );
                        return facts.length > 0 ? (
                          <ul className="rombo-scenario-board-facts">
                            {facts.map((fact) => (
                              <li key={fact.id}>{fact.text}</li>
                            ))}
                          </ul>
                        ) : null;
                      })()
                    : null}
                  {/* Coach prose renders SEPARATELY from the board-fact rows.
                      Question mode used to dump raw JSON here — same fix as
                      the free-state twin (mc-99 gate task_2ee644e07e2a),
                      same reused classes (mc-18 styled them in W2 #19). */}
                  {coachAnswer.response.mode === "question" ? (
                    <ul className="rombo-freestate-coach-questions">
                      {coachAnswer.response.selectedQuestions.map((q) => (
                        <li key={q.id}>
                          <p className="rombo-freestate-coach-question-text">
                            {q.question}
                          </p>
                          {q.whyItMatters ? (
                            <p className="rombo-freestate-coach-question-why">
                              {q.whyItMatters}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre className="rombo-scenario-coach-prose">
                      {coachAnswer.response.advice.tacticalReading}
                    </pre>
                  )}
                </div>
              ) : null}
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

      {/* H4 (W24-audit): estos tres SI sirven para presentar/compartir la
          pizarra — el audit los encontro enterrados en "Avanzado" al fondo
          de los 2000px del panel mientras el header promovia un "Modo
          presentacion" que no presentaba nada de esto. Suben a un lugar
          visible del panel; el payload JSON (debug/dev, no presentable)
          se queda abajo en "Avanzado". */}
      <section className="rombo-exports">
        <h2>Exportar / compartir</h2>
        <button type="button" onClick={onExportImage}>
          Exportar imagen
        </button>
        <button type="button" onClick={() => onExportBrief("staff")}>
          Exportar brief imprimible
        </button>
        <button type="button" onClick={() => onExportBrief("player")}>
          Brief jugadores
        </button>
      </section>

      <details className="rombo-advanced">
        <summary>Avanzado</summary>
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
