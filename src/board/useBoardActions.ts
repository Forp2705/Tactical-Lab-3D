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
  detectAttackDir,
} from "./scenarioBoardConsequence";
import { deriveTacticalReads, type TacticalRead } from "./boardTacticalRead";
import { samplePlayback } from "./boardPlayback";
import { auditScene, evaluateAction } from "./boardTacticalGrammar";
import {
  ARROW_BLOCK_HINT_TTL_MS,
  type ArrowGesturePhase,
  buildArrowFromGestureCommit,
  commitZoneDrag,
  handleCanvasPress,
  IDLE_ARROW_GESTURE,
  mergeFormationTokens,
  resolveZoneDragRect,
  semanticForTool,
  stepArrowGestureOnPointerDown,
  stepArrowGestureOnPointerUp,
  tokenFromPlanningPlayer,
} from "./boardTools";
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
  inferAiInterpretationFindings,
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
// H7 (W24): recencia honesta para el indicador unico de guardado — nunca
// finge "ahora" mas alla de 5s reales.
function formatSaveRecency(lastSavedAt: number, now: number): string {
  const elapsedSeconds = Math.max(0, Math.round((now - lastSavedAt) / 1000));
  if (elapsedSeconds < 5) return "Guardado ✓ justo ahora";
  if (elapsedSeconds < 60) return `Guardado ✓ hace ${elapsedSeconds}s`;
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  return `Guardado ✓ hace ${elapsedMinutes}min`;
}

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
  // Arrow gesture state machine (W24A): drag-to-create unified with
  // click-click as an explicit fallback. `arrowGesturePoint` is the live
  // pointer position tracked alongside the phase — kept separate from the
  // (pure, unit-tested) phase transitions themselves since it is render-only
  // (rubber-band preview), never part of a commit/cancel decision.
  const [arrowGesture, setArrowGesture] =
    useState<ArrowGesturePhase>(IDLE_ARROW_GESTURE);
  const [arrowGesturePoint, setArrowGesturePoint] =
    useState<BoardPoint | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    before: BoardPoint;
    offset: BoardPoint;
  } | null>(null);
  // Drag-to-create real de zona/bloque (W8): ancla en pointerdown, preview en
  // pointermove, commit unico en pointerup. `current` sigue el puntero;
  // `start` no se muta durante el gesto.
  const [zoneDrag, setZoneDrag] = useState<{
    tool: "zone" | "block";
    start: BoardPoint;
    current: BoardPoint;
  } | null>(null);
  const [history, setHistory] = useState<TacticalBoard[]>([]);
  const [future, setFuture] = useState<TacticalBoard[]>([]);
  const [status, setStatus] = useState("");
  // H7 (W24): una sola senal de guardado. lastSavedAt es la fuente de verdad
  // del autosave real (se toca en CADA persist, no solo al click de un boton);
  // nowTick solo existe para que la etiqueta de recencia se refresque sola.
  const [lastSavedAt, setLastSavedAt] = useState(() => Date.now());
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [payload, setPayload] = useState<BoardPayload | null>(null);
  const [attachBlockId, setAttachBlockId] = useState("");
  const [consequenceOverlay, setConsequenceOverlay] =
    useState<ConsequenceOverlay | null>(null);
  const committingOverlayRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Reactive board engine (mc-21): ephemeral tactical-read overlay, shown
  // only on drop (pointerup), never on pointermove. Cleared by its own
  // timeout so it never lingers as a stale reading.
  const [tacticalOverlay, setTacticalOverlay] = useState<{
    reads: TacticalRead[];
    key: number;
  } | null>(null);
  const tacticalOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    return () => {
      if (tacticalOverlayTimeoutRef.current) {
        clearTimeout(tacticalOverlayTimeoutRef.current);
      }
    };
  }, []);
  // FIXUP W25B: la razon de un block de gramatica tactica tiene que ganarle
  // al hint pasivo de la tool (ver resolveArrowHintText en boardTools.ts),
  // no perderse detras de el. Vigente por ARROW_BLOCK_HINT_TTL_MS (4s, en el
  // rango 3-5s pedido) o hasta que el usuario arranque un gesto nuevo real
  // (ver el clear temprano en onCanvasPointerDown) — lo que pase primero.
  const [grammarBlockNotice, setGrammarBlockNotice] = useState<{
    reason: string;
    key: number;
  } | null>(null);
  const grammarBlockNoticeTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  useEffect(() => {
    return () => {
      if (grammarBlockNoticeTimeoutRef.current) {
        clearTimeout(grammarBlockNoticeTimeoutRef.current);
      }
    };
  }, []);

  // Playback (W25A): 100% presentational state layered over the drawn
  // scene — samplePlayback never mutates it, nothing here is persisted.
  const [playbackTime, setPlaybackTimeState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<1 | 2>(1);
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTsRef = useRef<number | null>(null);

  const playbackFrame = useMemo(
    () => samplePlayback(scene, playbackTime),
    [scene, playbackTime],
  );

  // rAF SOLO mientras isPlaying (invariante W25A: el board no tiene loop de
  // render fuera de esto, y en pausa/idle vuelve a cero rAF).
  useEffect(() => {
    if (!isPlaying) {
      playbackLastTsRef.current = null;
      return;
    }
    let cancelled = false;
    const tick = (ts: number) => {
      if (cancelled) return;
      if (playbackLastTsRef.current === null) playbackLastTsRef.current = ts;
      const deltaSeconds = (ts - playbackLastTsRef.current) / 1000;
      playbackLastTsRef.current = ts;
      setPlaybackTimeState((prev) =>
        Math.min(prev + deltaSeconds * playbackSpeed, playbackFrame.duration),
      );
      playbackRafRef.current = requestAnimationFrame(tick);
    };
    playbackRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (playbackRafRef.current !== null) {
        cancelAnimationFrame(playbackRafRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, playbackFrame.duration]);

  // Llegar al final detiene el loop (los tokens quedan en posicion final,
  // PLAYBACK-DESIGN.md §5) sin resetear el tiempo — un segundo play vuelve a
  // arrancar desde 0 (ver playPlayback).
  useEffect(() => {
    if (
      isPlaying &&
      playbackFrame.duration > 0 &&
      playbackTime >= playbackFrame.duration
    ) {
      setIsPlaying(false);
    }
  }, [isPlaying, playbackTime, playbackFrame.duration]);

  // Editar durante playback pausa automaticamente y vuelve al estado
  // editable (PLAYBACK-DESIGN.md §7) — se llama desde commitScene (todo
  // commit real de la escena pasa por ahi) y desde el pointerdown del canvas
  // (para no dejar un drag/dibujo arrancar sobre un frame animado).
  const stopPlaybackForEdit = () => {
    setIsPlaying(false);
    setPlaybackTimeState(0);
  };

  const playPlayback = () => {
    if (playbackFrame.duration <= 0) return;
    if (playbackTime >= playbackFrame.duration) setPlaybackTimeState(0);
    setIsPlaying(true);
  };
  const pausePlayback = () => setIsPlaying(false);
  const setPlaybackTime = (next: number) =>
    setPlaybackTimeState(Math.min(Math.max(next, 0), playbackFrame.duration));
  const togglePlaybackSpeed = () =>
    setPlaybackSpeedState((current) => (current === 1 ? 2 : 1));

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
    rehydrateWorkspace,
  } = useBoardEditor(board, team.players, {
    persistWorkspace: updateBoardWorkspace,
    onPersist: () => setLastSavedAt(Date.now()),
  });

  // Reset transient selection/payload when switching boards (the workspace
  // itself is hydrated by useBoardEditor).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs only when the active board changes
  useEffect(() => {
    setSelection(null);
    setPayload(null);
  }, [board.id]);

  // Esc cancela un gesto de flecha en curso (pending o armed) — gesto de
  // salida explicito, nunca deja el origen colgado (W24A H3).
  useEffect(() => {
    if (arrowGesture.phase === "idle") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setArrowGesture(IDLE_ARROW_GESTURE);
        setArrowGesturePoint(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arrowGesture]);

  // Cambiar de tool a mitad de un gesto de flecha lo cancela — mismo
  // invariante "nunca fantasma" que Escape, para no dejar un origen armado
  // esperando un click de una tool distinta.
  useEffect(() => {
    setArrowGesture(IDLE_ARROW_GESTURE);
    setArrowGesturePoint(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only on tool change
  }, [tool]);

  // Esc cancela un drag-to-create de zona/bloque en curso (mismo gesto de
  // salida que drawStart, para no dejar el rectangulo colgado).
  useEffect(() => {
    if (!zoneDrag) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoneDrag(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoneDrag]);

  const { selectedObject, selectedArrow, selectedZone } = resolveBoardSelection(
    selection,
    scene,
  );

  const aiInterpretation = useMemo(
    () =>
      inferAiInterpretationFindings({
        players: roster,
        objects: scene.objects,
        arrows: scene.arrows,
        zones: scene.zones,
      }),
    [roster, scene],
  );

  // Reactive board engine (mc-21): deterministic geometric reads, recomputed
  // on every scene change — same trigger aiInterpretation already uses,
  // including every pointermove during a token drag (pre-existing behavior,
  // not new). This feeds the ALWAYS-live chips surface; the ephemeral canvas
  // overlay below is a separate, pointerup-gated snapshot of this same read.
  const attackDir = useMemo(() => detectAttackDir(scene).dir, [scene]);
  const tacticalReads = useMemo(
    () => deriveTacticalReads(scene, attackDir, team.players),
    [scene, attackDir, team.players],
  );

  // Gramatica tactica (W25B): warnings vigentes de la escena tal como esta
  // ahora — derivado en el mismo ciclo que tacticalReads, nunca acumulado
  // (undo/borrado de la flecha que disparaba un warning lo hace desaparecer
  // solo, sin estado propio que limpiar). El bloqueo duro vive en el punto
  // de commit del gesto (commitProposedArrow mas abajo), no aca.
  const grammarWarnings = useMemo(() => auditScene(scene), [scene]);

  const readiness = useMemo(
    () => buildBoardReadiness(board, session.blocks, scene),
    [board, session.blocks, scene],
  );

  // W24A H2: explica el silencio del motor (doctrina medicion != fabricacion,
  // intocable — nunca se rellena una lectura vacia con un aviso generico).
  // Un tacticalReads vacio puede significar dos cosas MUY distintas para el
  // usuario: "el motor no tiene con que medir" (ningun token propio con rol
  // asignado) vs "midio y el resultado es equilibrado, sin nada que decir"
  // (silencio deliberado). Solo el primer caso amerita un estado vacio
  // explicito; el segundo se queda mudo, como hoy. Presentacion pura sobre
  // scene.objects — no toca boardTacticalRead.ts (motor en hold de mc-18).
  const hasAnyOwnRoleAssigned = scene.objects.some(
    (object) => object.type === "playerToken" && Boolean(object.role?.trim()),
  );

  const activeLayers = getActiveLayers(layers);
  // Token origen del anclaje en curso (para resaltarlo en el canvas).
  const anchorOriginId =
    arrowGesture.phase !== "idle" && arrowGesture.origin.kind === "object"
      ? arrowGesture.origin.objectId
      : undefined;

  // Rubber-band de la flecha en curso (W24A): visible tanto en el drag real
  // (phase "pending", el pointer todavia esta abajo) como en el fallback
  // click-click ya armado (phase "armed", esperando el segundo click) — la
  // UNICA diferencia visual entre ambos es el texto de estado ("armed" pide
  // el segundo click explicitamente).
  const arrowGesturePreview =
    arrowGesture.phase !== "idle" && arrowGesturePoint
      ? {
          origin: arrowGesture.origin,
          current: arrowGesturePoint,
          armed: arrowGesture.phase === "armed",
        }
      : null;

  // Preview del rectangulo de zona/bloque en curso: misma resolucion
  // (umbral/normalizacion) que el commit final, para que el rubber-band
  // muestre exactamente lo que se va a crear en el pointerup.
  const zoneDragPreview = zoneDrag
    ? {
        ...resolveZoneDragRect(zoneDrag.start, zoneDrag.current),
        block: zoneDrag.tool === "block",
      }
    : null;

  const pushHistory = (snapshot = board) => {
    setHistory((items) => [...items.slice(-24), snapshot]);
    setFuture([]);
  };

  const commitBoard = (nextBoard: TacticalBoard, record = true) => {
    if (record) pushHistory();
    updateTacticalBoard(board.id, nextBoard);
    setLastSavedAt(Date.now());
  };

  const commitScene = (patch: Partial<BoardScene>, record = true) => {
    stopPlaybackForEdit();
    if (record) pushHistory();
    // A scene mutation invalidates any pending projection — it was computed
    // for this exact scene state and anchored to its objectIds (spec §5.4).
    // The overlay's own accept path sets committingOverlayRef to skip this.
    if (!committingOverlayRef.current) {
      setConsequenceOverlay((prev) => (prev ? null : prev));
    }
    updateTacticalBoardScene(board.id, scene.id, patch);
    // H7 (W24): drag/draw/borrar en el canvas pasa por ACA, no por el
    // workspace reducer (onPersist). El indicador de guardado unico tiene
    // que reaccionar a esto tambien o miente en la accion mas comun del board.
    setLastSavedAt(Date.now());
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
      // BoardPayload.aiInterpretation es string[] (contrato del JSON
      // exportable); aiInterpretation aca es la version rica con id para el
      // panel, no se filtra el shape hacia el export.
      aiInterpretation: aiInterpretation.map((finding) => finding.text),
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
    setLastSavedAt(Date.now());
    // No repite "guardado": el objetivo, la regla y la condicion de exito ya
    // se autoguardan solos; esta accion sincroniza esos campos al resumen que
    // consume el brief exportable (exportBoard.ts), asi que la confirmacion
    // describe eso, no un segundo "guardado" compitiendo con el indicador.
    setStatus("Resumen del brief actualizado");
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
    // Resync mirrored workspace fields (e.g. the formation dropdown) from
    // the snapshot we just restored — "board" here is still last render's
    // value, so this must read from `previous`, not `board` (w3 T2).
    rehydrateWorkspace(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, board]);
    setFuture((items) => items.slice(1));
    updateTacticalBoard(board.id, next);
    rehydrateWorkspace(next);
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
    const previousOwnTokens = scene.objects.filter(
      (object) => object.type === "playerToken",
    );
    setTeamAFormation(formation);
    updateSceneObjects([
      ...scene.objects.filter((object) => object.type !== "playerToken"),
      ...mergeFormationTokens(previousOwnTokens, ownTokens),
    ]);
  };

  // Contrato explicito (mc-21 w2 A2): replace-total, sin preservar
  // note/isDangerPlayer. A diferencia de los tokens propios (linkedPlayerId =
  // identidad estable del jugador, independiente de la formacion), un token
  // rival no representa una persona sino "un rol posicional dentro de ESTA
  // formacion" (number = index+1 del slot). Cambiar de formacion cambia el
  // significado de cada indice (el slot 5 en 4-4-2 es un lateral; en 4-2-3-1
  // puede ser un doble pivote) — matchear por indice pegaria una nota/marca
  // de peligroso en el lugar equivocado, que es peor que perderla. Ver
  // tests/board.test.ts para el test que fija este contrato.
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
      x: number;
      y: number;
      w: number;
      h: number;
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

  // Seleccionar (zona/flecha/objeto) a mitad de un gesto de flecha lo
  // cancela, para no dejar el origen colgado en medio-estado.
  const onCanvasSelect = (next: Selection) => {
    if (arrowGesture.phase !== "idle") {
      setArrowGesture(IDLE_ARROW_GESTURE);
      setArrowGesturePoint(null);
    }
    setSelection(next);
  };

  // Dispara el overlay efimero de lectura reactiva (mc-21) sobre el resultado
  // de UN commit de gesto (drop de token o flecha creada/movida) — nunca en
  // pointermove. Compartido por el drag de token y el gesto de flecha (W24A
  // H2: el loop gesto->lectura tiene que dispararse para los dos, no solo
  // para el primero).
  const fireTacticalOverlay = () => {
    const overlayReads = tacticalReads.filter(
      (read) => read.kind === "lateralBias" || read.kind === "blockHeight",
    );
    if (overlayReads.length === 0) return;
    if (tacticalOverlayTimeoutRef.current) {
      clearTimeout(tacticalOverlayTimeoutRef.current);
    }
    setTacticalOverlay({ reads: overlayReads, key: Date.now() });
    tacticalOverlayTimeoutRef.current = setTimeout(() => {
      setTacticalOverlay(null);
    }, 1600);
  };

  // FIXUP W25B: dispara la razon de block por el mismo renglon del hint
  // pasivo (ver resolveArrowHintText), vigente ARROW_BLOCK_HINT_TTL_MS o
  // hasta el proximo gesto real (clear temprano en onCanvasPointerDown).
  const fireGrammarBlockNotice = (reason: string) => {
    if (grammarBlockNoticeTimeoutRef.current) {
      clearTimeout(grammarBlockNoticeTimeoutRef.current);
    }
    setGrammarBlockNotice({ reason, key: Date.now() });
    grammarBlockNoticeTimeoutRef.current = setTimeout(() => {
      setGrammarBlockNotice(null);
    }, ARROW_BLOCK_HINT_TTL_MS);
  };

  // Unico punto de friccion de la gramatica tactica (W25B): interceptado
  // entre "la maquina de estados de gesto ya decidio comitear una flecha" y
  // "la flecha entra a la escena". Se llama desde los dos handlers donde el
  // gesto puede resolver un commit (click-click en pointerDown, drag en
  // pointerUp) — misma decision logica, dos puntos fisicos porque la
  // maquina de estados de W24A los separa asi (ver boardTools.ts).
  const commitProposedArrow = (arrow: BoardArrow) => {
    const evaluation = evaluateAction(scene, arrow);
    if (evaluation.verdict === "block") {
      const reason =
        evaluation.reason ??
        "Accion bloqueada: no tiene sentido tactico en esta escena.";
      setStatus(reason);
      fireGrammarBlockNotice(reason);
      return;
    }
    commitScene({ arrows: [...scene.arrows, arrow] });
    fireTacticalOverlay();
  };

  const onCanvasPointerDown = (point: BoardPoint, targetId?: string) => {
    // Cualquier interaccion de edicion con la cancha corta el playback en
    // curso ANTES de arrancar el gesto — nunca se dibuja/arrastra sobre un
    // frame animado (PLAYBACK-DESIGN.md §7).
    stopPlaybackForEdit();
    // move/select sobre un token -> arrancar drag (y cancelar cualquier
    // gesto de flecha en curso). Comportamiento existente.
    if (targetId && (tool === "move" || tool === "select")) {
      const object = scene.objects.find((item) => item.id === targetId);
      if (object) {
        setArrowGesture(IDLE_ARROW_GESTURE);
        setArrowGesturePoint(null);
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
    // zone/block: ya no crea en el press. Ancla el punto de partida del
    // rectangulo; el commit real pasa en el pointerup (drag-to-create, W8).
    if (tool === "zone" || tool === "block") {
      setArrowGesture(IDLE_ARROW_GESTURE);
      setArrowGesturePoint(null);
      setZoneDrag({ tool, start: point, current: point });
      return;
    }
    // Flechas (W24A): la decision drag-vs-click se resuelve en el pointerup
    // (stepArrowGestureOnPointerUp); el pointerdown solo arranca el gesto
    // pending o resuelve el segundo click de un origen ya armado.
    const arrowSemantic = semanticForTool(tool);
    if (arrowSemantic) {
      const endpoint: BoardArrowEndpoint = targetId
        ? { kind: "object", objectId: targetId }
        : { kind: "point", point };
      const result = stepArrowGestureOnPointerDown(
        arrowGesture,
        endpoint,
        point,
      );
      // FIX audit W24A H3/H7: arrancar un origen nuevo (idle -> pending)
      // limpia la seleccion del Inspector — antes quedaba mostrando lo que
      // fuera que estuviera seleccionado antes de dibujar (p.ej. un jugador),
      // dando la falsa sensacion de que el Inspector no reacciona al gesto.
      // FIXUP W25B: ese mismo instante (arranca un gesto nuevo real) es
      // tambien el punto en el que una razon de block previa deja de estar
      // vigente — el usuario ya se movio a intentar de nuevo, asi que el
      // hint pasivo/armed puede volver a tomar el renglon.
      if (arrowGesture.phase === "idle" && result.next.phase === "pending") {
        setSelection(null);
        if (grammarBlockNoticeTimeoutRef.current) {
          clearTimeout(grammarBlockNoticeTimeoutRef.current);
        }
        setGrammarBlockNotice(null);
      }
      if (result.commit) {
        const arrow = buildArrowFromGestureCommit(result.commit, tool, {
          color,
          tone: String(lineWidth),
        });
        if (arrow) {
          commitProposedArrow(arrow);
        }
      }
      if (result.cancelledSameToken) {
        setStatus("Flecha cancelada: el origen y el destino son el mismo jugador");
      }
      setArrowGesture(result.next);
      setArrowGesturePoint(result.next.phase === "idle" ? null : point);
      return;
    }
    // Equipamiento: crea en el punto, sin gesto de dos fases.
    handleCanvasPress({ point, tool, scene, color, updateSceneObjects });
  };

  const onCanvasPointerMove = (point: BoardPoint) => {
    if (arrowGesture.phase !== "idle") {
      setArrowGesturePoint(point);
      return;
    }
    if (zoneDrag) {
      setZoneDrag((prev) => (prev ? { ...prev, current: point } : prev));
      return;
    }
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

  const onCanvasPointerUp = (point: BoardPoint, targetId?: string) => {
    if (arrowGesture.phase === "pending") {
      const endpoint: BoardArrowEndpoint = targetId
        ? { kind: "object", objectId: targetId }
        : { kind: "point", point };
      const result = stepArrowGestureOnPointerUp(
        arrowGesture,
        point,
        endpoint,
      );
      if (result.commit) {
        const arrow = buildArrowFromGestureCommit(result.commit, tool, {
          color,
          tone: String(lineWidth),
        });
        if (arrow) {
          commitProposedArrow(arrow);
        }
      }
      if (result.cancelledSameToken) {
        setStatus("Flecha cancelada: arrastre sobre el mismo jugador");
      }
      setArrowGesture(result.next);
      setArrowGesturePoint(result.next.phase === "idle" ? null : point);
      return;
    }
    if (zoneDrag) {
      commitZoneDrag({
        tool: zoneDrag.tool,
        start: zoneDrag.start,
        end: zoneDrag.current,
        scene,
        color,
        commitScene,
      });
      setZoneDrag(null);
      return;
    }
    if (!drag) return;
    const object = scene.objects.find((item) => item.id === drag.id);
    if (object && distance(object.position, drag.before) > 0.4) {
      setHistory((items) => [...items.slice(-24), board]);
      setFuture([]);
      // Ephemeral tactical-read overlay (mc-21): fires ONLY here, on a real
      // drop, never on pointermove. `tacticalReads` above is already the read
      // for this exact post-drop scene (same render's useMemo). Restricted to
      // the two kinds that have a canvas visual (lateralBias band tint,
      // blockHeight ghost line) — the other kinds are chips-only this wave.
      fireTacticalOverlay();
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
    const simulation = simulateScenario(input, { includeMissingShapeCaveat: false });
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
    saveIndicator: formatSaveRecency(lastSavedAt, nowTick),
    // W25C: UI viva — clave estable para el micro-pulso del indicador (solo
    // en un guardado REAL, no en cada tick de reloj que refresca el texto
    // "hace Ns"; lastSavedAt cambia solo cuando de verdad se persiste).
    lastSavedAt,
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
    zoneDragPreview,
    arrowGesturePreview,
    isArrowToolActive: semanticForTool(tool) !== null,
    aiInterpretation,
    tacticalReads,
    grammarWarnings,
    hasAnyOwnRoleAssigned,
    grammarBlockNotice,
    tacticalOverlay,
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
    // playback (W25A)
    playbackTime,
    playbackDuration: playbackFrame.duration,
    playbackPositions: playbackFrame.positions,
    playbackArrowProgress: playbackFrame.arrowProgress,
    isPlaying,
    playbackSpeed,
    playPlayback,
    pausePlayback,
    setPlaybackTime,
    togglePlaybackSpeed,
  };
}
