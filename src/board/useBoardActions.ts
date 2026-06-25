import { useAppStore } from "@/state/useAppStore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type BoardTool,
  type DraftPlayer,
  type Selection,
  emptyDraft,
  formationPoints,
} from "./boardConstants";
import {
  blockTitle,
  clamp,
  distance,
  downloadBlob,
  slug,
} from "./boardGeometry";
import type {
  BoardArrow,
  BoardArrowEndpoint,
  BoardArrowSemantic,
  BoardObject,
  BoardPoint,
  BoardScene,
  BoardZoneSemantic,
  TacticalBoard,
} from "./boardModel";
import {
  arrowSemanticPatch,
  arrowTargetZonePatch,
  createBoardId,
  createDefaultBoardScene,
  createOpponentShape,
  createPlayerToken,
  createSemanticArrow,
  createTacticalZone,
  zoneSemanticPatch,
} from "./boardModel";
import { catalog } from "@/data";
import type { ScenarioId } from "@/ai/scenarioSimulator";
import { simulateScenario } from "@/ai/scenarioSimulator";
import { buildScenarioInput } from "./scenarioBridge";
import {
  type ConsequenceOverlay,
  buildConsequenceOverlay,
} from "./scenarioBoardConsequence";
import { handleCanvasPress, tokenFromPlanningPlayer } from "./boardTools";
import {
  boardProjectLabel,
  buildBoardReadiness,
  getActiveLayers,
  resolveBoardSelection,
} from "./boardViewModel";
import {
  buildTacticalBoardBriefingExport,
  tacticalBoardSceneSvgString,
} from "./exportBoard";
import {
  type BoardPayload,
  type PlanningBoardPlayer,
  buildBoardPayload,
  inferAiInterpretation,
} from "./productBoardTypes";
import { useBoardEditor } from "./useBoardEditor";

/**
 * Orchestrates everything the board workspace needs: transient editor UI state,
 * the persisted workspace (via useBoardEditor), derived view models, and the
 * full set of board action handlers. Domain logic lives here; the view only
 * wires the returned bag to presentational components.
 */
/**
 * Preview ≡ commit: map the overlay 1:1 to real board items via the existing
 * factories. Zero recompute — if this re-derived geometry it would reintroduce
 * two sources of truth.
 */
export function overlayToBoardItems(overlay: ConsequenceOverlay) {
  const zones = overlay.zones.map((z) =>
    createTacticalZone(z.semantic, z.x, z.y, z.w, z.h, z.patch),
  );
  const arrows = overlay.arrows.map((a) =>
    createSemanticArrow(a.semantic, a.from, a.to, a.patch),
  );
  return { zones, arrows };
}

export function useBoardActions(board: TacticalBoard, scene: BoardScene) {
  const {
    team,
    gameModel,
    session,
    weeklyDecisionThread,
    openTacticalBoard,
    updateTacticalBoard,
    updateBoardWorkspace,
    updateTacticalBoardScene,
    duplicateTacticalBoardScene,
    reorderTacticalBoardScenes,
    attachBoardToSessionBlock,
    createSessionBlockFromBoardScene,
  } = useAppStore();

  const [tool, setTool] = useState<BoardTool>("move");
  const [color, setColor] = useState("#1677ff");
  const [lineWidth, setLineWidth] = useState(2);
  const [zoom, setZoom] = useState(100);
  const [selection, setSelection] = useState<Selection>(null);
  const [draft, setDraft] = useState<DraftPlayer>(emptyDraft);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<BoardArrowEndpoint | null>(null);
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
  const [consequenceOverlay, setConsequenceOverlay] =
    useState<ConsequenceOverlay | null>(null);
  const committingOverlayRef = useRef(false);
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
  }, [board.id]);

  // Esc cancela un anclaje en curso (gesto de salida del estado draw-en-curso).
  useEffect(() => {
    if (!drawStart) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawStart(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawStart]);

  const { selectedObject, selectedArrow, selectedZone } = resolveBoardSelection(
    selection,
    scene,
  );

  const aiInterpretation = useMemo(
    () =>
      inferAiInterpretation({
        players: roster,
        objects: scene.objects,
        arrows: scene.arrows,
        zones: scene.zones,
      }),
    [roster, scene],
  );

  const readiness = useMemo(
    () => buildBoardReadiness(board, session.blocks, scene),
    [board, session.blocks, scene],
  );

  const activeLayers = getActiveLayers(layers);
  // Token origen del anclaje en curso (para resaltarlo en el canvas).
  const anchorOriginId =
    drawStart?.kind === "object" ? drawStart.objectId : undefined;

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
    // A scene mutation invalidates any pending projection — it was computed
    // for this exact scene state and anchored to its objectIds (spec §5.4).
    // The overlay's own accept path sets committingOverlayRef to skip this.
    if (!committingOverlayRef.current) {
      setConsequenceOverlay((prev) => (prev ? null : prev));
    }
    updateTacticalBoardScene(board.id, scene.id, patch);
  };

  // Discard a pending overlay when the active scene changes — it is anchored to
  // objectIds of the scene it was computed for (spec §5.4).
  useEffect(() => {
    setConsequenceOverlay(null);
  }, [scene.id]);

  const updateSceneObjects = (objects: BoardObject[], record = true) =>
    commitScene({ objects }, record);
  const updateSceneArrows = (arrows: BoardArrow[], record = true) =>
    commitScene({ arrows }, record);

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
    setStatus("Payload JSON copiado al portapapeles");
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

  // Cambiar el tipo de la flecha (re-deriva tacticalMeaning si estaba default).
  const setArrowSemantic = (semantic: BoardArrowSemantic) => {
    if (!selectedArrow) return;
    updateSelectedArrow(arrowSemanticPatch(selectedArrow, semantic));
  };

  // Zona objetivo de la flecha (edit affordance). Mutuamente excluyente con un
  // `to` anclado a objeto. La creacion nativa via segundo-click es P0.4b.
  const setArrowTargetZone = (zoneId: string | null) => {
    if (!selectedArrow) return;
    const zone = zoneId
      ? (scene.zones.find((item) => item.id === zoneId) ?? null)
      : null;
    updateSelectedArrow(arrowTargetZonePatch(zone));
  };

  // Cambiar el tipo de la zona (re-deriva color/label si estaban default).
  const setZoneSemantic = (semantic: BoardZoneSemantic) => {
    if (!selectedZone) return;
    updateSelectedZone(zoneSemanticPatch(selectedZone, semantic));
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

  // Seleccionar (zona/flecha/objeto) a mitad de un draw lo cancela, para no
  // dejar drawStart colgado en medio-estado.
  const onCanvasSelect = (next: Selection) => {
    if (drawStart) setDrawStart(null);
    setSelection(next);
  };

  const onCanvasPointerDown = (point: BoardPoint, targetId?: string) => {
    // move/select sobre un token -> arrancar drag (y cancelar cualquier draw
    // en curso). Comportamiento existente.
    if (targetId && (tool === "move" || tool === "select")) {
      const object = scene.objects.find((item) => item.id === targetId);
      if (object) {
        setDrawStart(null);
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
    // Flechas/zonas/equipamiento: targetId se pasa a handleCanvasPress. Las
    // flechas lo usan para anclar al token; zona/equipamiento lo ignoran y
    // crean en el punto.
    handleCanvasPress({
      point,
      tool,
      targetId,
      scene,
      color,
      lineWidth,
      drawStart,
      setDrawStart,
      commitScene,
      updateSceneObjects,
    });
  };

  const onCanvasPointerMove = (point: BoardPoint) => {
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
  };

  const onCanvasPointerUp = () => {
    if (!drag) return;
    const object = scene.objects.find((item) => item.id === drag.id);
    if (object && distance(object.position, drag.before) > 0.4) {
      setHistory((items) => [...items.slice(-24), board]);
      setFuture([]);
    }
    setDrag(null);
  };

  const toggleLayer = (layerId: string) =>
    setLayers((items) =>
      items.map((item) =>
        item.id === layerId ? { ...item, visible: !item.visible } : item,
      ),
    );

  const selectScene = (sceneId: string) => openTacticalBoard(board.id, sceneId);

  const moveScene = () =>
    reorderTacticalBoardScenes(
      board.id,
      Math.max(0, board.scenes.findIndex((item) => item.id === scene.id) - 1),
      board.scenes.findIndex((item) => item.id === scene.id),
    );

  const createSessionBlock = () =>
    createSessionBlockFromBoardScene(board.id, scene.id);

  const zoomOut = () => setZoom((value) => Math.max(80, value - 10));
  const zoomIn = () => setZoom((value) => Math.min(130, value + 10));

  const runScenario = (scenarioId: ScenarioId) => {
    const { input } = buildScenarioInput(
      scene,
      team.players,
      gameModel,
      catalog,
      scenarioId,
      problem,
    );
    const simulation = simulateScenario(input);
    setConsequenceOverlay(buildConsequenceOverlay(simulation, scene));
  };

  const commitOverlay = () => {
    if (!consequenceOverlay) return;
    const { zones, arrows } = overlayToBoardItems(consequenceOverlay);
    committingOverlayRef.current = true;
    commitScene({
      zones: [...scene.zones, ...zones],
      arrows: [...scene.arrows, ...arrows],
    });
    committingOverlayRef.current = false;
    setConsequenceOverlay(null);
  };

  const discardOverlay = () => setConsequenceOverlay(null);

  return {
    // transient UI state
    tool,
    setTool,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    zoom,
    selection,
    setSelection,
    draft,
    setDraft,
    editingPlayerId,
    status,
    payload,
    attachBlockId,
    setAttachBlockId,
    svgRef,
    // persisted workspace
    roster,
    problem,
    exercise,
    layers,
    currentView,
    teamAFormation,
    setProblem,
    setExercise,
    setCurrentView,
    // derived view models
    selectedObject,
    selectedArrow,
    selectedZone,
    activeLayers,
    anchorOriginId,
    aiInterpretation,
    readiness,
    projectLabel: boardProjectLabel(weeklyDecisionThread?.problem),
    sessionBlocks: session.blocks,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    // action handlers
    createPayload,
    saveBoard,
    addScene,
    deleteCurrentScene,
    duplicateScene,
    undo,
    redo,
    applyOwnFormation,
    applyOpponentFormation,
    assignPlayerToPitch,
    savePlayerDraft,
    editRosterPlayer,
    deleteRosterPlayer,
    updateSelectedObject,
    updateSelectedArrow,
    updateSelectedZone,
    setArrowSemantic,
    setArrowTargetZone,
    setZoneSemantic,
    deleteSelection,
    exportImage,
    exportBrief,
    attachToBlock,
    onCanvasSelect,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    toggleLayer,
    selectScene,
    moveScene,
    createSessionBlock,
    zoomOut,
    zoomIn,
    // scenario sandbox
    consequenceOverlay,
    runScenario,
    commitOverlay,
    discardOverlay,
  };
}
