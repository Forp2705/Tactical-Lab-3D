import {
  type BoardArrow,
  type BoardArrowSemantic,
  type BoardObject,
  type BoardPoint,
  type BoardScene,
  type BoardZoneSemantic,
  type TacticalBoard,
  buildTacticalBoardBriefingExport,
  createBoardId,
  createDefaultBoardScene,
  createOpponentShape,
  createPlayerToken,
  tacticalBoardSceneSvgString,
} from "@/board";
import type { SessionBlock } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import {
  type MutableRefObject,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type BoardTool,
  COLORS,
  type DraftPlayer,
  FORMATIONS,
  LINE_WIDTHS,
  PITCH_H,
  PITCH_W,
  type Selection,
  TOOL_DEFS,
  VIEW_OPTIONS,
  emptyDraft,
  exerciseFields,
  formationPoints,
} from "./boardConstants";
import {
  blockTitle,
  clamp,
  distance,
  downloadBlob,
  endpointPoint,
  layerVisibleForArrow,
  pointFromSvgEvent,
  scaleY,
  shortName,
  slug,
  zoneVisible,
} from "./boardGeometry";
import {
  handleCanvasPress,
  labelForTool,
  tokenFromPlanningPlayer,
} from "./boardTools";
import { TacticalBoardAiPanel } from "./components/TacticalBoardAiPanel";
import { TacticalBoardCanvas } from "./components/TacticalBoardCanvas";
import { TacticalBoardFooter } from "./components/TacticalBoardFooter";
import { TacticalBoardInspectorPanel } from "./components/TacticalBoardInspectorPanel";
import { TacticalBoardProblemPanel } from "./components/TacticalBoardProblemPanel";
import { TacticalBoardRosterPanel } from "./components/TacticalBoardRosterPanel";
import { TacticalBoardToolRail } from "./components/TacticalBoardToolRail";
import { TacticalBoardTopbar } from "./components/TacticalBoardTopbar";
import {
  type BoardPayload,
  type CurrentBoardView,
  DEFAULT_BOARD_LAYERS,
  DEFAULT_EXERCISE_BUILDER,
  DEFAULT_TACTICAL_PROBLEM,
  type ExerciseBuilder,
  type PlanningBoardLayer,
  type PlanningBoardPlayer,
  type TacticalProblem,
  buildBoardPayload,
  inferAiInterpretation,
} from "./productBoardTypes";
import { useBoardEditor } from "./useBoardEditor";

export function TacticalBoardView() {
  const {
    tacticalBoards,
    activeBoardId,
    activeBoardSceneId,
    team,
    session,
    weeklyDecisionThread,
    createTacticalBoard,
    createTacticalBoardFromWeeklyFocus,
    openTacticalBoard,
    updateTacticalBoard,
    updateBoardWorkspace,
    updateTacticalBoardScene,
    duplicateTacticalBoardScene,
    reorderTacticalBoardScenes,
    attachBoardToSessionBlock,
    createSessionBlockFromBoardScene,
  } = useAppStore();

  const requestedMissing = Boolean(
    activeBoardId &&
      !tacticalBoards.some((board) => board.id === activeBoardId),
  );
  const board =
    tacticalBoards.find((item) => item.id === activeBoardId) ??
    (!activeBoardId && tacticalBoards.length === 1 ? tacticalBoards[0] : null);
  const scene =
    board?.scenes.find((item) => item.id === activeBoardSceneId) ??
    board?.scenes[0] ??
    null;

  const [tool, setTool] = useState<BoardTool>("move");
  const [color, setColor] = useState("#1677ff");
  const [lineWidth, setLineWidth] = useState(2);
  const [zoom, setZoom] = useState(100);
  const [selection, setSelection] = useState<Selection>(null);
  const [draft, setDraft] = useState<DraftPlayer>(emptyDraft);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<BoardPoint | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    before: BoardPoint;
    offset: BoardPoint;
  } | null>(null);
  const [history, setHistory] = useState<TacticalBoard[]>([]);
  const [future, setFuture] = useState<TacticalBoard[]>([]);
  const [status, setStatus] = useState("Guardado automaticamente");
  const [payload, setPayload] = useState<BoardPayload | null>(null);
  const [attachBlockId, setAttachBlockId] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const {
    roster,
    problem,
    exercise,
    layers,
    currentView,
    teamAFormation,
    setRoster,
    setProblem,
    setExercise,
    setLayers,
    setCurrentView,
    setTeamAFormation,
  } = useBoardEditor(board, team.players, {
    persistWorkspace: updateBoardWorkspace,
    onPersist: () => setStatus("Guardado automaticamente"),
  });

  // Reset transient selection/payload when switching boards (the workspace
  // itself is hydrated by useBoardEditor).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs only when the active board changes
  useEffect(() => {
    setSelection(null);
    setPayload(null);
  }, [board?.id]);

  const selectedObject =
    selection?.kind === "object"
      ? (scene?.objects.find((object) => object.id === selection.id) ?? null)
      : null;
  const selectedArrow =
    selection?.kind === "arrow"
      ? (scene?.arrows.find((arrow) => arrow.id === selection.id) ?? null)
      : null;
  const selectedZone =
    selection?.kind === "zone"
      ? (scene?.zones.find((zone) => zone.id === selection.id) ?? null)
      : null;

  const aiInterpretation = useMemo(
    () =>
      scene
        ? inferAiInterpretation({
            tacticalProblem: problem,
            players: roster,
            arrows: scene.arrows,
            zones: scene.zones,
            exercise,
          })
        : [],
    [problem, roster, scene, exercise],
  );

  const readiness = useMemo(
    () => [
      board?.linkedWeeklyFocusId
        ? "Foco semanal vinculado"
        : "Sin foco semanal",
      session.blocks.some((block) => block.boardId === board?.id)
        ? "Sesion vinculada"
        : "Sin sesion",
      scene?.instructions.some(
        (instruction) => instruction.visibility === "player",
      )
        ? "Brief jugadores listo"
        : "Faltan instrucciones visibles",
      scene?.notes ? "Notas staff presentes" : "Sin notas staff",
    ],
    [board?.id, board?.linkedWeeklyFocusId, session.blocks, scene],
  );

  if (!board || !scene) {
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
            La pizarra convierte un problema tactico en anotaciones, ejercicio
            entrenable y payload para el generador.
          </p>
          <div className="rombo-board-empty-actions">
            <button
              type="button"
              className="primary"
              onClick={() => createTacticalBoardFromWeeklyFocus()}
            >
              Crear desde foco semanal
            </button>
            <button
              type="button"
              onClick={() => createTacticalBoard({ title: "Pizarra tactica" })}
            >
              Nueva pizarra
            </button>
          </div>
        </div>
      </section>
    );
  }

  const pushHistory = (snapshot = board) => {
    setHistory((items) => [...items.slice(-24), snapshot]);
    setFuture([]);
  };

  const commitBoard = (nextBoard: TacticalBoard, record = true) => {
    if (record) pushHistory();
    updateTacticalBoard(board.id, nextBoard);
  };

  const commitScene = (patch: Partial<BoardScene>, record = true) => {
    if (record) pushHistory();
    updateTacticalBoardScene(board.id, scene.id, patch);
  };

  const updateSceneObjects = (objects: BoardObject[], record = true) =>
    commitScene({ objects }, record);
  const updateSceneArrows = (arrows: BoardArrow[], record = true) =>
    commitScene({ arrows }, record);

  const activeLayers = new Set(
    layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );

  const createPayload = async () => {
    const nextPayload = buildBoardPayload(board, scene, {
      currentView,
      tacticalProblem: problem,
      roster,
      teamAFormation,
      exercise,
      layers,
      aiInterpretation,
    });
    setPayload(nextPayload);
    setStatus("Payload estructurado listo para el generador");
    await navigator.clipboard
      ?.writeText(JSON.stringify(nextPayload, null, 2))
      .catch(() => undefined);
  };

  const saveBoard = () => {
    updateTacticalBoard(board.id, {
      title: board.title,
      description: problem.problem,
      globalInstruction: problem.objective,
      sessionCoachingPoints: [exercise.objective, exercise.rule].filter(
        Boolean,
      ),
      successSignals: [exercise.successCondition].filter(Boolean),
    });
    setStatus("Pizarra guardada");
  };

  const addScene = () => {
    const nextScene = createDefaultBoardScene(
      `Escena ${board.scenes.length + 1}`,
      "ataque posicional",
      [],
    );
    commitBoard({ ...board, scenes: [...board.scenes, nextScene] });
    openTacticalBoard(board.id, nextScene.id);
  };

  const deleteCurrentScene = () => {
    if (board.scenes.length < 2) return;
    const nextScenes = board.scenes.filter((item) => item.id !== scene.id);
    commitBoard({ ...board, scenes: nextScenes });
    openTacticalBoard(board.id, nextScenes[0]?.id);
  };

  const duplicateScene = () => {
    pushHistory();
    duplicateTacticalBoardScene(board.id, scene.id);
    setStatus("Escena duplicada");
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [board, ...items]);
    setHistory((items) => items.slice(0, -1));
    updateTacticalBoard(board.id, previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, board]);
    setFuture((items) => items.slice(1));
    updateTacticalBoard(board.id, next);
  };

  const applyOwnFormation = (formation: string) => {
    const points = formationPoints[formation] ?? formationPoints["4-3-3"];
    const ownTokens = points.map((point, index) => {
      const player = roster[index];
      return player
        ? tokenFromPlanningPlayer(
            player,
            { x: point.x, y: point.y },
            point.role,
            index + 1,
          )
        : createPlayerToken(
            null,
            { x: point.x, y: point.y },
            point.role,
            index + 1,
          );
    });
    setTeamAFormation(formation);
    updateSceneObjects([
      ...scene.objects.filter((object) => object.type !== "playerToken"),
      ...ownTokens,
    ]);
  };

  const applyOpponentFormation = (formation: string) => {
    const opponent = createOpponentShape(formation);
    commitBoard({
      ...board,
      opponent: { ...board.opponent, formation },
      scenes: board.scenes.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              objects: [
                ...item.objects.filter(
                  (object) => object.type !== "opponentToken",
                ),
                ...opponent,
              ],
            }
          : item,
      ),
    });
  };

  const assignPlayerToPitch = (player: PlanningBoardPlayer) => {
    const exists = scene.objects.some(
      (object) => object.linkedPlayerId === player.id,
    );
    if (exists) return;
    const count = scene.objects.filter(
      (object) => object.type === "playerToken",
    ).length;
    const point = formationPoints[teamAFormation]?.[count] ?? {
      x: 40 + count * 3,
      y: 50,
      role: player.position,
    };
    updateSceneObjects([
      ...scene.objects,
      tokenFromPlanningPlayer(
        player,
        { x: point.x, y: point.y },
        point.role,
        count + 1,
      ),
    ]);
  };

  const savePlayerDraft = () => {
    const cleanName = draft.name.trim();
    if (!cleanName) return;
    const nextPlayer: PlanningBoardPlayer = {
      id: editingPlayerId ?? createBoardId("roster"),
      ...draft,
      name: cleanName,
      position: draft.position || "Sin puesto",
      number: draft.number || "",
      traits: draft.traits || "",
    };
    setRoster((players) =>
      editingPlayerId
        ? players.map((player) =>
            player.id === editingPlayerId ? nextPlayer : player,
          )
        : [...players, nextPlayer],
    );
    setDraft(emptyDraft);
    setEditingPlayerId(null);
  };

  const editRosterPlayer = (player: PlanningBoardPlayer) => {
    setDraft({
      name: player.name,
      position: player.position,
      number: player.number,
      traits: player.traits,
      team: player.team,
      role: player.role ?? "",
      task: player.task ?? "",
    });
    setEditingPlayerId(player.id);
  };

  const deleteRosterPlayer = (playerId: string) => {
    setRoster((players) => players.filter((player) => player.id !== playerId));
    updateSceneObjects(
      scene.objects.filter((object) => object.linkedPlayerId !== playerId),
    );
  };

  const updateSelectedObject = (patch: Partial<BoardObject>) => {
    if (!selectedObject) return;
    updateSceneObjects(
      scene.objects.map((object) =>
        object.id === selectedObject.id ? { ...object, ...patch } : object,
      ),
    );
  };

  const updateSelectedArrow = (patch: Partial<BoardArrow>) => {
    if (!selectedArrow) return;
    updateSceneArrows(
      scene.arrows.map((arrow) =>
        arrow.id === selectedArrow.id ? { ...arrow, ...patch } : arrow,
      ),
    );
  };

  const updateSelectedZone = (
    patch: Partial<{
      label: string;
      tacticalMeaning: string;
      semantic: BoardZoneSemantic;
      color: string;
    }>,
  ) => {
    if (!selectedZone) return;
    commitScene({
      zones: scene.zones.map((zone) =>
        zone.id === selectedZone.id ? { ...zone, ...patch } : zone,
      ),
    });
  };

  const deleteSelection = () => {
    if (!selection) return;
    if (selection.kind === "object") {
      updateSceneObjects(
        scene.objects.filter((object) => object.id !== selection.id),
      );
    }
    if (selection.kind === "arrow") {
      updateSceneArrows(
        scene.arrows.filter((arrow) => arrow.id !== selection.id),
      );
    }
    if (selection.kind === "zone") {
      commitScene({
        zones: scene.zones.filter((zone) => zone.id !== selection.id),
      });
    }
    setSelection(null);
  };

  const exportImage = () => {
    const svg = tacticalBoardSceneSvgString(scene, false);
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `romboiq-board-${slug(board.title)}-${slug(scene.title)}.svg`,
    );
    setStatus("Imagen SVG exportada");
  };

  const exportBrief = (audience: "player" | "staff") => {
    const output = buildTacticalBoardBriefingExport(board, audience);
    downloadBlob(
      new Blob([output.html], { type: output.mimeType }),
      output.filename,
    );
    setStatus(
      audience === "player"
        ? "Brief jugadores exportado"
        : "Brief staff exportado",
    );
  };

  const attachToBlock = () => {
    if (!attachBlockId) return;
    attachBoardToSessionBlock(attachBlockId, board.id, scene.id);
    const block = session.blocks.find((item) => item.id === attachBlockId);
    setStatus(`Escena vinculada a ${blockTitle(block)}`);
  };

  return (
    <section className="rombo-board-shell">
      <TacticalBoardTopbar
        projectLabel={
          weeklyDecisionThread?.problem
            ? "Foco semanal activo"
            : "Partido vs. Rojos FC"
        }
        currentView={currentView}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onAddScene={addScene}
        onUndo={undo}
        onRedo={redo}
        onCurrentViewChange={setCurrentView}
        onCreatePayload={createPayload}
        onSaveBoard={saveBoard}
      />

      <div className="rombo-board-health">
        {readiness.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <main className="rombo-board-layout">
        <TacticalBoardToolRail
          tool={tool}
          color={color}
          lineWidth={lineWidth}
          onToolChange={setTool}
          onColorChange={setColor}
          onLineWidthChange={setLineWidth}
          onDeleteSelection={deleteSelection}
        />

        <TacticalBoardCanvas
          svgRef={svgRef}
          scene={scene}
          selection={selection}
          color={color}
          lineWidth={lineWidth}
          tool={tool}
          activeLayers={activeLayers}
          zoom={zoom}
          teamAFormation={teamAFormation}
          opponentFormation={board.opponent.formation}
          keyInstructions={{
            objective: problem.objective,
            rule: exercise.rule,
            successCondition: exercise.successCondition,
          }}
          onSelect={setSelection}
          onPointerDown={(point, targetId) => {
            if (targetId) {
              const object = scene.objects.find((item) => item.id === targetId);
              if (object && (tool === "move" || tool === "select")) {
                setSelection({ kind: "object", id: targetId });
                setDrag({
                  id: targetId,
                  before: object.position,
                  offset: {
                    x: point.x - object.position.x,
                    y: point.y - object.position.y,
                  },
                });
              }
              return;
            }
            handleCanvasPress({
              point,
              tool,
              scene,
              color,
              lineWidth,
              drawStart,
              setDrawStart,
              commitScene,
              updateSceneObjects,
            });
          }}
          onPointerMove={(point) => {
            if (!drag) return;
            const next = {
              x: clamp(point.x - drag.offset.x, 2, 98),
              y: clamp(point.y - drag.offset.y, 4, 96),
            };
            updateSceneObjects(
              scene.objects.map((object) =>
                object.id === drag.id ? { ...object, position: next } : object,
              ),
              false,
            );
          }}
          onPointerUp={() => {
            if (!drag) return;
            const object = scene.objects.find((item) => item.id === drag.id);
            if (object && distance(object.position, drag.before) > 0.4) {
              setHistory((items) => [...items.slice(-24), board]);
              setFuture([]);
            }
            setDrag(null);
          }}
          onOwnFormationChange={applyOwnFormation}
          onOpponentFormationChange={applyOpponentFormation}
        />

        <aside className="rombo-right-panel">
          <TacticalBoardRosterPanel
            teamAFormation={teamAFormation}
            draft={draft}
            editingPlayerId={editingPlayerId}
            roster={roster}
            onApplyOwnFormation={applyOwnFormation}
            onDraftChange={setDraft}
            onSavePlayerDraft={savePlayerDraft}
            onAssignPlayerToPitch={assignPlayerToPitch}
            onEditRosterPlayer={editRosterPlayer}
            onDeleteRosterPlayer={deleteRosterPlayer}
          />

          <TacticalBoardInspectorPanel
            selectedObject={selectedObject}
            selectedArrow={selectedArrow}
            selectedZone={selectedZone}
            onUpdateObject={updateSelectedObject}
            onUpdateArrow={updateSelectedArrow}
            onUpdateZone={updateSelectedZone}
          />

          <TacticalBoardProblemPanel
            problem={problem}
            exercise={exercise}
            onProblemChange={setProblem}
            onExerciseChange={setExercise}
          />

          <TacticalBoardAiPanel
            aiInterpretation={aiInterpretation}
            layers={layers}
            payload={payload}
            attachBlockId={attachBlockId}
            sessionBlocks={session.blocks}
            canDeleteScene={board.scenes.length >= 2}
            onToggleLayer={(layerId) =>
              setLayers((items) =>
                items.map((item) =>
                  item.id === layerId
                    ? { ...item, visible: !item.visible }
                    : item,
                ),
              )
            }
            onCreatePayload={createPayload}
            onExportImage={exportImage}
            onExportBrief={exportBrief}
            onDuplicateScene={duplicateScene}
            onDeleteCurrentScene={deleteCurrentScene}
            onAttachBlockIdChange={setAttachBlockId}
            onAttachToBlock={attachToBlock}
            onCreateSessionBlock={() =>
              createSessionBlockFromBoardScene(board.id, scene.id)
            }
          />
        </aside>
      </main>

      <TacticalBoardFooter
        scenes={board.scenes}
        currentSceneId={scene.id}
        status={status}
        zoom={zoom}
        onSelectScene={(sceneId) => openTacticalBoard(board.id, sceneId)}
        onAddScene={addScene}
        onZoomOut={() => setZoom((value) => Math.max(80, value - 10))}
        onZoomIn={() => setZoom((value) => Math.min(130, value + 10))}
        onMoveScene={() =>
          reorderTacticalBoardScenes(
            board.id,
            Math.max(
              0,
              board.scenes.findIndex((item) => item.id === scene.id) - 1,
            ),
            board.scenes.findIndex((item) => item.id === scene.id),
          )
        }
      />
    </section>
  );
}
