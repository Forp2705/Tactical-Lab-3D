import { useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import { requestBoardScenarioTurn } from "@/ai/coachAgentClient";
import { buildBoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { BoardEvidencePacket } from "@/board/boardEvidencePacket";
import type { CoachResponse } from "@/ai/CoachSchemas";
import type { BoardScene, TacticalBoard } from "./boardModel";
import { resolveActiveBoard, resolveActiveScene } from "./boardViewModel";
import { TacticalBoardAiPanel } from "./components/TacticalBoardAiPanel";
import { TacticalBoardCanvas } from "./components/TacticalBoardCanvas";
import { TacticalBoardEmptyState } from "./components/TacticalBoardEmptyState";
import { TacticalBoardFooter } from "./components/TacticalBoardFooter";
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

  const board = resolveActiveBoard(tacticalBoards, activeBoardId);
  const scene = resolveActiveScene(board, activeBoardSceneId);

  if (!board || !scene) {
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

  return <TacticalBoardWorkspace board={board} scene={scene} />;
}

function TacticalBoardWorkspace({
  board,
  scene,
}: {
  board: TacticalBoard;
  scene: BoardScene;
}) {
  const a = useBoardActions(board, scene);

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

  return (
    <section className="rombo-board-shell">
      <TacticalBoardTopbar
        projectLabel={a.projectLabel}
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
          consequenceOverlay={a.consequenceOverlay}
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
          <TacticalBoardRosterPanel
            teamAFormation={a.teamAFormation}
            draft={a.draft}
            editingPlayerId={a.editingPlayerId}
            roster={a.roster}
            onApplyOwnFormation={a.applyOwnFormation}
            onDraftChange={a.setDraft}
            onSavePlayerDraft={a.savePlayerDraft}
            onAssignPlayerToPitch={a.assignPlayerToPitch}
            onEditRosterPlayer={a.editRosterPlayer}
            onDeleteRosterPlayer={a.deleteRosterPlayer}
          />

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

          <TacticalBoardProblemPanel
            problem={a.problem}
            exercise={a.exercise}
            onProblemChange={a.setProblem}
            onExerciseChange={a.setExercise}
          />

          <TacticalBoardAiPanel
            aiInterpretation={a.aiInterpretation}
            layers={a.layers}
            payload={a.payload}
            attachBlockId={a.attachBlockId}
            sessionBlocks={a.sessionBlocks}
            canDeleteScene={board.scenes.length >= 2}
            consequenceOverlay={a.consequenceOverlay}
            coachLoading={coachLoading}
            coachError={coachError}
            coachAnswer={coachAnswer}
            onRunScenario={a.runScenario}
            onAskCoach={onAskCoach}
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
        </aside>
      </main>

      <TacticalBoardFooter
        scenes={board.scenes}
        currentSceneId={scene.id}
        status={a.status}
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
