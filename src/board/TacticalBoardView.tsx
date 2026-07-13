import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import {
  requestBoardFreeStateTurn,
  requestBoardScenarioTurn,
} from "@/ai/coachAgentClient";
import { buildBoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import {
  allFreeStateFactRefs,
  renderableFreeStateFacts,
} from "@/board/boardFactPresentation";
import {
  buildBoardFreeStateEvidencePacket,
  type BoardFreeStateEvidencePacket,
} from "@/board/boardFreeStateEvidencePacket";
import type { CoachResponse } from "@/ai/CoachSchemas";
import type { BoardScene, TacticalBoard } from "./boardModel";
import { resolveActiveBoard, resolveActiveScene } from "./boardViewModel";
import { TacticalBoardAiPanel } from "./components/TacticalBoardAiPanel";
import { TacticalBoardCanvas } from "./components/TacticalBoardCanvas";
import { TacticalBoardEmptyState } from "./components/TacticalBoardEmptyState";
import { TacticalBoardErrorBoundary } from "./components/TacticalBoardErrorBoundary";
import { TacticalBoardFooter } from "./components/TacticalBoardFooter";
import { TacticalBoardGhostSceneState } from "./components/TacticalBoardGhostSceneState";
import { TacticalBoardInspectorPanel } from "./components/TacticalBoardInspectorPanel";
import { TacticalBoardProblemPanel } from "./components/TacticalBoardProblemPanel";
import { TacticalBoardRosterPanel } from "./components/TacticalBoardRosterPanel";
import { TacticalBoardToolRail } from "./components/TacticalBoardToolRail";
import { TacticalBoardTopbar } from "./components/TacticalBoardTopbar";
import { useBoardActions } from "./useBoardActions";

export function TacticalBoardView() {
  const tacticalBoards = useAppStore((state) => state.tacticalBoards);
  const activeBoardId = useAppStore((state) => state.activeBoardId);
  const activeBoardSceneId = useAppStore((state) => state.activeBoardSceneId);
  const createTacticalBoard = useAppStore((state) => state.createTacticalBoard);
  const createTacticalBoardFromWeeklyFocus = useAppStore(
    (state) => state.createTacticalBoardFromWeeklyFocus,
  );
  const openTacticalBoard = useAppStore((state) => state.openTacticalBoard);

  const board = resolveActiveBoard(tacticalBoards, activeBoardId);
  const scene = resolveActiveScene(board, activeBoardSceneId);

  if (!board) {
    const requestedMissing = Boolean(
      activeBoardId &&
        !tacticalBoards.some((item) => item.id === activeBoardId),
    );
    return (
      <TacticalBoardEmptyState
        requestedMissing={requestedMissing}
        onCreateFromWeeklyFocus={() => createTacticalBoardFromWeeklyFocus()}
        onCreateBlank={() => createTacticalBoard({ title: "Pizarra tactica" })}
      />
    );
  }

  if (!scene) {
    return (
      <TacticalBoardGhostSceneState
        onOpenFirstScene={() =>
          openTacticalBoard(board.id, board.scenes[0]?.id)
        }
      />
    );
  }

  return (
    <TacticalBoardErrorBoundary>
      <TacticalBoardWorkspace board={board} scene={scene} />
    </TacticalBoardErrorBoundary>
  );
}

function TacticalBoardWorkspace({
  board,
  scene,
}: {
  board: TacticalBoard;
  scene: BoardScene;
}) {
  const a = useBoardActions(board, scene);

  // W24A H1/H2: el panel derecho pasa de "todo apilado, scrollHeight 2022 vs
  // clientHeight 598" (audit) a tabs — cada seccion entra en el alto
  // disponible sin depender de un scroll interno de 630px para llegar a las
  // lecturas. Default "ai": es la seccion que el audit marca como la que
  // menos se puede seguir enterrando (H2 acceptance: lecturas visibles sin
  // scroll al abrir la pizarra, cero clicks).
  const [rightPanelTab, setRightPanelTab] = useState<
    "roster" | "inspector" | "problem" | "ai"
  >("ai");

  // Seleccionar algo en la cancha (token/flecha/zona) salta al tab Inspector
  // — es lo que se espera editar justo despues de seleccionar, y es el
  // contrato que boardRenderCrashClass.test.tsx ya fija (Rol visible apenas
  // se selecciona un token). No dispara en el mount (selection arranca null).
  useEffect(() => {
    if (a.selection) setRightPanelTab("inspector");
    // biome-ignore lint/correctness/useExhaustiveDependencies: only react to selection changes
  }, [a.selection]);

  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  // The parsed coach response AND the EXACT packet that was asked are held together
  // in transient state. The held packet is the ONE that was sent (never rebuilt from
  // a possibly-changed overlay at render time), so the board-fact rows always match
  // the claims the coach actually saw. Both are set together on success and cleared
  // together on each new ask / on error — a previous answer never renders as new.
  const [coachAnswer, setCoachAnswer] = useState<{
    response: CoachResponse;
    packet: BoardEvidencePacket;
  } | null>(null);

  // One-shot board->coach bridge. Build the structured packet from the audited
  // overlay readout and POST it via /api. On ANY failure set an honest error
  // message — NEVER fall back to a packet-less coach call or a stale answer.
  const onAskCoach = async () => {
    const overlay = a.consequenceOverlay;
    if (!overlay) return; // guard: only when an overlay exists
    const packet = buildBoardEvidencePacket(overlay);
    const question = `Probamos este ajuste en la pizarra: ${overlay.title}. ¿Qué te parece?`;
    setCoachLoading(true);
    setCoachError(null);
    setCoachAnswer(null);
    try {
      const response = await requestBoardScenarioTurn(question, packet);
      setCoachAnswer({ response, packet });
    } catch (error) {
      setCoachError(
        error instanceof Error
          ? error.message
          : "No se pudo consultar al coach.",
      );
    } finally {
      setCoachLoading(false);
    }
  };

  // Free-state bridge (mc-21 w2 B): independent transient state from the
  // scenario-overlay one above — asking about the current scene must never
  // be gated by, or interfere with, the canned-scenario flow.
  const [freeStateCoachLoading, setFreeStateCoachLoading] = useState(false);
  const [freeStateCoachError, setFreeStateCoachError] = useState<
    string | null
  >(null);
  const [freeStateCoachAnswer, setFreeStateCoachAnswer] = useState<{
    response: CoachResponse;
    packet: BoardFreeStateEvidencePacket;
  } | null>(null);

  // Recomputed from the live scene/workspace on every render — this is a
  // "what would we send right now" preview, not a held snapshot (unlike
  // coachAnswer.packet, which freezes the packet that was ACTUALLY asked).
  const freeStatePacket = useMemo(
    () =>
      buildBoardFreeStateEvidencePacket(
        board,
        scene,
        a.teamAFormation,
        a.activeLayers,
      ),
    [board, scene, a.teamAFormation, a.activeLayers],
  );
  const freeStateSummary = useMemo(
    () =>
      renderableFreeStateFacts(
        freeStatePacket,
        allFreeStateFactRefs(freeStatePacket),
      ),
    [freeStatePacket],
  );

  const onAskCoachFreeState = async () => {
    const packet = freeStatePacket; // pin the exact packet being asked
    const question = `Esta es la escena actual de la pizarra (${packet.freeStateEvidence.factualClaims.length} hechos declarados). ¿Que te parece?`;
    setFreeStateCoachLoading(true);
    setFreeStateCoachError(null);
    setFreeStateCoachAnswer(null);
    try {
      const response = await requestBoardFreeStateTurn(question, packet);
      setFreeStateCoachAnswer({ response, packet });
    } catch (error) {
      setFreeStateCoachError(
        error instanceof Error
          ? error.message
          : "No se pudo consultar al coach.",
      );
    } finally {
      setFreeStateCoachLoading(false);
    }
  };

  return (
    <section className="rombo-board-shell">
      <TacticalBoardTopbar
        currentView={a.currentView}
        canUndo={a.canUndo}
        canRedo={a.canRedo}
        onAddScene={a.addScene}
        onUndo={a.undo}
        onRedo={a.redo}
        onCurrentViewChange={a.setCurrentView}
        onSaveBoard={a.saveBoard}
      />

      <div className="rombo-board-health">
        {a.readiness.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <main className="rombo-board-layout">
        <TacticalBoardToolRail
          tool={a.tool}
          color={a.color}
          lineWidth={a.lineWidth}
          onToolChange={a.setTool}
          onColorChange={a.setColor}
          onLineWidthChange={a.setLineWidth}
          onDeleteSelection={a.deleteSelection}
        />

        <TacticalBoardCanvas
          svgRef={a.svgRef}
          scene={scene}
          selection={a.selection}
          color={a.color}
          lineWidth={a.lineWidth}
          tool={a.tool}
          activeLayers={a.activeLayers}
          zoom={a.zoom}
          teamAFormation={a.teamAFormation}
          opponentFormation={board.opponent.formation}
          anchorOriginId={a.anchorOriginId}
          zoneDragPreview={a.zoneDragPreview}
          arrowGesturePreview={a.arrowGesturePreview}
          isArrowToolActive={a.isArrowToolActive}
          grammarBlockNotice={a.grammarBlockNotice}
          consequenceOverlay={a.consequenceOverlay}
          tacticalOverlay={a.tacticalOverlay}
          keyInstructions={{
            objective: a.problem.objective,
            rule: a.exercise.rule,
            successCondition: a.exercise.successCondition,
          }}
          onSelect={a.onCanvasSelect}
          onPointerDown={a.onCanvasPointerDown}
          onPointerMove={a.onCanvasPointerMove}
          onPointerUp={a.onCanvasPointerUp}
          onOwnFormationChange={a.applyOwnFormation}
          onOpponentFormationChange={a.applyOpponentFormation}
        />

        <aside className="rombo-right-panel">
          <div className="rombo-right-panel-tabs" role="tablist">
            {(
              [
                ["roster", "Plantel"],
                ["inspector", "Inspector"],
                ["problem", "Ejercicio"],
                ["ai", "IA / Lecturas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={rightPanelTab === id}
                className={rightPanelTab === id ? "active" : ""}
                onClick={() => setRightPanelTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rombo-right-panel-body">
            {rightPanelTab === "roster" ? (
              <TacticalBoardRosterPanel
                draft={a.draft}
                editingPlayerId={a.editingPlayerId}
                roster={a.roster}
                onDraftChange={a.setDraft}
                onSavePlayerDraft={a.savePlayerDraft}
                onAssignPlayerToPitch={a.assignPlayerToPitch}
                onEditRosterPlayer={a.editRosterPlayer}
                onDeleteRosterPlayer={a.deleteRosterPlayer}
              />
            ) : null}

            {rightPanelTab === "inspector" ? (
              <TacticalBoardInspectorPanel
                selectedObject={a.selectedObject}
                selectedArrow={a.selectedArrow}
                selectedZone={a.selectedZone}
                zones={scene.zones.map((zone) => ({
                  id: zone.id,
                  label: zone.label,
                }))}
                sceneSummary={{
                  title: scene.title,
                  phase: scene.phaseLabel,
                  problem: a.problem.problem,
                }}
                onUpdateObject={a.updateSelectedObject}
                onUpdateArrow={a.updateSelectedArrow}
                onUpdateZone={a.updateSelectedZone}
                onSetArrowSemantic={a.setArrowSemantic}
                onSetArrowTargetZone={a.setArrowTargetZone}
                onSetZoneSemantic={a.setZoneSemantic}
                onDelete={a.deleteSelection}
              />
            ) : null}

            {rightPanelTab === "problem" ? (
              <TacticalBoardProblemPanel
                problem={a.problem}
                exercise={a.exercise}
                onProblemChange={a.setProblem}
                onExerciseChange={a.setExercise}
              />
            ) : null}

            {rightPanelTab === "ai" ? (
              <TacticalBoardAiPanel
                aiInterpretation={a.aiInterpretation}
                tacticalReads={a.tacticalReads}
                hasAnyOwnRoleAssigned={a.hasAnyOwnRoleAssigned}
                grammarWarnings={a.grammarWarnings}
                layers={a.layers}
                payload={a.payload}
                attachBlockId={a.attachBlockId}
                sessionBlocks={a.sessionBlocks}
                canDeleteScene={board.scenes.length >= 2}
                consequenceOverlay={a.consequenceOverlay}
                coachLoading={coachLoading}
                coachError={coachError}
                coachAnswer={coachAnswer}
                freeStateSummary={freeStateSummary}
                freeStateCoachLoading={freeStateCoachLoading}
                freeStateCoachError={freeStateCoachError}
                freeStateCoachAnswer={freeStateCoachAnswer}
                onRunScenario={a.runScenario}
                onAskCoach={onAskCoach}
                onAskCoachFreeState={onAskCoachFreeState}
                onCommitOverlay={a.commitOverlay}
                onDiscardOverlay={a.discardOverlay}
                onToggleLayer={a.toggleLayer}
                onExportPayload={a.createPayload}
                onExportImage={a.exportImage}
                onExportBrief={a.exportBrief}
                onDuplicateScene={a.duplicateScene}
                onDeleteCurrentScene={a.deleteCurrentScene}
                onAttachBlockIdChange={a.setAttachBlockId}
                onAttachToBlock={a.attachToBlock}
                onCreateSessionBlock={a.createSessionBlock}
              />
            ) : null}
          </div>
        </aside>
      </main>

      <TacticalBoardFooter
        scenes={board.scenes}
        currentSceneId={scene.id}
        status={a.status}
        saveIndicator={a.saveIndicator}
        zoom={a.zoom}
        onSelectScene={a.selectScene}
        onAddScene={a.addScene}
        onZoomOut={a.zoomOut}
        onZoomIn={a.zoomIn}
        onMoveScene={a.moveScene}
      />
    </section>
  );
}
