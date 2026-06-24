import { useAppStore } from "@/state/useAppStore";
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
        onConvertToTraining={a.createSessionBlock}
        onExportPayload={a.createPayload}
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
          keyInstructions={{
            objective: a.problem.objective,
            rule: a.exercise.rule,
            successCondition: a.exercise.successCondition,
          }}
          onSelect={a.setSelection}
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
            onUpdateObject={a.updateSelectedObject}
            onUpdateArrow={a.updateSelectedArrow}
            onUpdateZone={a.updateSelectedZone}
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
