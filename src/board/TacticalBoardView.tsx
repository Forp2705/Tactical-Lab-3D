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

const STORAGE_PREFIX = "romboiq-planning-board";

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
  const [currentView, setCurrentView] = useState<CurrentBoardView>("Ataque");
  const [teamAFormation, setTeamAFormation] = useState("4-3-3");
  const [zoom, setZoom] = useState(100);
  const [selection, setSelection] = useState<Selection>(null);
  const [roster, setRoster] = useState<PlanningBoardPlayer[]>([]);
  const [draft, setDraft] = useState<DraftPlayer>(emptyDraft);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [problem, setProblem] = useState<TacticalProblem>(
    DEFAULT_TACTICAL_PROBLEM,
  );
  const [exercise, setExercise] = useState<ExerciseBuilder>(
    DEFAULT_EXERCISE_BUILDER,
  );
  const [layers, setLayers] =
    useState<PlanningBoardLayer[]>(DEFAULT_BOARD_LAYERS);
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

  useEffect(() => {
    if (!board) return;
    const saved = readWorkspace(board.id);
    const seededRoster: PlanningBoardPlayer[] = team.players.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.positions[0] ?? "Sin puesto",
      number: player.num,
      traits: player.profile,
      team: "A",
    }));
    setRoster(saved?.roster?.length ? saved.roster : seededRoster);
    setProblem(
      saved?.problem ?? {
        problem:
          board.description ||
          weeklyDecisionThread?.problem ||
          DEFAULT_TACTICAL_PROBLEM.problem,
        objective:
          board.globalInstruction || DEFAULT_TACTICAL_PROBLEM.objective,
      },
    );
    setExercise(saved?.exercise ?? DEFAULT_EXERCISE_BUILDER);
    setLayers(saved?.layers ?? DEFAULT_BOARD_LAYERS);
    setCurrentView(saved?.currentView ?? "Ataque");
    setTeamAFormation(saved?.teamAFormation ?? "4-3-3");
    setSelection(null);
    setPayload(null);
  }, [
    board?.id,
    team.players,
    weeklyDecisionThread,
    board?.description,
    board?.globalInstruction,
    board,
  ]);

  useEffect(() => {
    if (!board) return;
    writeWorkspace(board.id, {
      roster,
      problem,
      exercise,
      layers,
      currentView,
      teamAFormation,
    });
    setStatus("Guardado automaticamente");
  }, [
    board?.id,
    roster,
    problem,
    exercise,
    layers,
    currentView,
    teamAFormation,
    board,
  ]);

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
      <header className="rombo-board-topbar">
        <div className="rombo-brand">RomboIQ</div>
        <div className="rombo-title-block">
          <h1>Pizarra tactica</h1>
          <p>
            Proyecto:{" "}
            {weeklyDecisionThread?.problem
              ? "Foco semanal activo"
              : "Partido vs. Rojos FC"}
          </p>
        </div>
        <button type="button" onClick={addScene}>
          Nueva escena
        </button>
        <div className="rombo-board-undo">
          <button type="button" onClick={undo} disabled={!history.length}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!future.length}>
            Redo
          </button>
        </div>
        <label className="rombo-board-select">
          Vista actual
          <select
            value={currentView}
            onChange={(event) =>
              setCurrentView(event.target.value as CurrentBoardView)
            }
          >
            {VIEW_OPTIONS.map((view) => (
              <option key={view}>{view}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rombo-primary-cta"
          onClick={createPayload}
        >
          Generar secuencia desde pizarra
          <span>Las anotaciones se envian al generador</span>
        </button>
        <button type="button" onClick={createPayload}>
          Compartir
        </button>
        <button type="button" className="rombo-save" onClick={saveBoard}>
          Guardar
        </button>
      </header>

      <div className="rombo-board-health">
        {readiness.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <main className="rombo-board-layout">
        <aside className="rombo-toolrail" aria-label="Herramientas">
          <h2>Herramientas</h2>
          {TOOL_DEFS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={tool === item.id ? "active" : ""}
              onClick={() => setTool(item.id)}
            >
              <ToolIcon tool={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
          <div className="rombo-tool-group">
            <h3>Color y grosor</h3>
            <div className="rombo-color-row">
              {COLORS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={color === item ? "selected" : ""}
                  style={{ background: item }}
                  aria-label={`Color ${item}`}
                  onClick={() => setColor(item)}
                />
              ))}
            </div>
            <div className="rombo-width-row">
              {LINE_WIDTHS.map((width) => (
                <button
                  type="button"
                  key={width}
                  className={lineWidth === width ? "active" : ""}
                  onClick={() => setLineWidth(width)}
                >
                  {width}
                </button>
              ))}
            </div>
            <button type="button" className="danger" onClick={deleteSelection}>
              Borrar seleccionado
            </button>
          </div>
        </aside>

        <section className="rombo-pitch-panel">
          <div className="rombo-pitch-toolbar">
            <select
              value={teamAFormation}
              onChange={(event) => applyOwnFormation(event.target.value)}
            >
              {FORMATIONS.map((formation) => (
                <option key={formation}>{formation}</option>
              ))}
            </select>
            <select
              value={board.opponent.formation}
              onChange={(event) => applyOpponentFormation(event.target.value)}
            >
              {FORMATIONS.map((formation) => (
                <option key={formation}>{formation}</option>
              ))}
            </select>
          </div>
          <TacticalPitch
            refEl={svgRef}
            scene={scene}
            selected={selection}
            color={color}
            lineWidth={lineWidth}
            tool={tool}
            activeLayers={activeLayers}
            zoom={zoom}
            onSelect={setSelection}
            onPointerDown={(point, targetId) => {
              if (targetId) {
                const object = scene.objects.find(
                  (item) => item.id === targetId,
                );
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
                  object.id === drag.id
                    ? { ...object, position: next }
                    : object,
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
          />
          <div className="rombo-key-instructions">
            <strong>Instrucciones clave</strong>
            <ul>
              <li>{problem.objective}</li>
              <li>{exercise.rule}</li>
              <li>{exercise.successCondition}</li>
            </ul>
          </div>
        </section>

        <aside className="rombo-right-panel">
          <section>
            <h2>Distribucion</h2>
            <div className="rombo-formation-grid">
              {FORMATIONS.map((formation) => (
                <button
                  type="button"
                  key={formation}
                  className={teamAFormation === formation ? "active" : ""}
                  onClick={() => applyOwnFormation(formation)}
                >
                  {formation}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Mi equipo / Plantel</h2>
            <div className="rombo-player-form">
              <input
                placeholder="Nombre"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
              <input
                placeholder="Puesto"
                value={draft.position}
                onChange={(event) =>
                  setDraft({ ...draft, position: event.target.value })
                }
              />
              <input
                placeholder="Numero"
                value={draft.number}
                onChange={(event) =>
                  setDraft({ ...draft, number: event.target.value })
                }
              />
              <textarea
                placeholder="Rasgos / caracteristicas"
                value={draft.traits}
                onChange={(event) =>
                  setDraft({ ...draft, traits: event.target.value })
                }
              />
              <button type="button" onClick={savePlayerDraft}>
                {editingPlayerId ? "Guardar jugador" : "Agregar jugador"}
              </button>
            </div>
            <div className="rombo-roster-list">
              {roster.map((player) => (
                <article key={player.id}>
                  <button
                    type="button"
                    onClick={() => assignPlayerToPitch(player)}
                  >
                    Agregar a cancha
                  </button>
                  <strong>
                    {player.number} - {player.name}
                  </strong>
                  <span>{player.position}</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => editRosterPlayer(player)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRosterPlayer(player.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2>Jugador / Inspector</h2>
            {selectedObject ? (
              <div className="rombo-inspector">
                <input
                  value={selectedObject.label}
                  onChange={(event) =>
                    updateSelectedObject({ label: event.target.value })
                  }
                />
                <input
                  value={selectedObject.role ?? ""}
                  placeholder="Rol tactico"
                  onChange={(event) =>
                    updateSelectedObject({ role: event.target.value })
                  }
                />
                <textarea
                  value={selectedObject.note ?? ""}
                  placeholder="Tarea / rasgos"
                  onChange={(event) =>
                    updateSelectedObject({ note: event.target.value })
                  }
                />
                <span>
                  Equipo: {selectedObject.type === "opponentToken" ? "B" : "A"}
                </span>
              </div>
            ) : selectedArrow ? (
              <div className="rombo-inspector">
                <input
                  value={selectedArrow.label ?? ""}
                  placeholder="Etiqueta"
                  onChange={(event) =>
                    updateSelectedArrow({ label: event.target.value })
                  }
                />
                <textarea
                  value={selectedArrow.tacticalMeaning ?? ""}
                  placeholder="Intencion tactica"
                  onChange={(event) =>
                    updateSelectedArrow({ tacticalMeaning: event.target.value })
                  }
                />
              </div>
            ) : selectedZone ? (
              <div className="rombo-inspector">
                <input
                  value={selectedZone.label}
                  onChange={(event) =>
                    updateSelectedZone({ label: event.target.value })
                  }
                />
                <textarea
                  value={selectedZone.tacticalMeaning ?? ""}
                  placeholder="Intencion de zona"
                  onChange={(event) =>
                    updateSelectedZone({ tacticalMeaning: event.target.value })
                  }
                />
              </div>
            ) : (
              <p>Selecciona una ficha, flecha, zona o nota para editar.</p>
            )}
          </section>

          <section>
            <h2>Problema tactico</h2>
            <label>
              Problema
              <textarea
                value={problem.problem}
                onChange={(event) =>
                  setProblem({ ...problem, problem: event.target.value })
                }
              />
            </label>
            <label>
              Objetivo
              <textarea
                value={problem.objective}
                onChange={(event) =>
                  setProblem({ ...problem, objective: event.target.value })
                }
              />
            </label>
          </section>

          <section>
            <h2>Constructor de ejercicio</h2>
            {exerciseFields.map((field) => (
              <label key={field.key}>
                {field.label}
                <input
                  value={exercise[field.key]}
                  onChange={(event) =>
                    setExercise({
                      ...exercise,
                      [field.key]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
          </section>

          <section>
            <h2>Que entiende la IA</h2>
            <ul className="rombo-ai-list">
              {aiInterpretation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Capas / vistas</h2>
            <div className="rombo-layer-list">
              {layers.map((layer) => (
                <label key={layer.id}>
                  <input
                    type="checkbox"
                    checked={layer.visible}
                    onChange={() =>
                      setLayers((items) =>
                        items.map((item) =>
                          item.id === layer.id
                            ? { ...item, visible: !item.visible }
                            : item,
                        ),
                      )
                    }
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
              onClick={createPayload}
            >
              Enviar al generador
            </button>
            <button type="button" onClick={exportImage}>
              Exportar imagen
            </button>
            <button type="button" onClick={() => exportBrief("staff")}>
              Exportar brief imprimible
            </button>
            <button type="button" onClick={() => exportBrief("player")}>
              Brief jugadores
            </button>
            <button type="button" onClick={duplicateScene}>
              Duplicar escena
            </button>
            <button
              type="button"
              onClick={deleteCurrentScene}
              disabled={board.scenes.length < 2}
            >
              Eliminar escena
            </button>
            <select
              value={attachBlockId}
              onChange={(event) => setAttachBlockId(event.target.value)}
            >
              <option value="">Vincular a bloque...</option>
              {session.blocks.map((block, index) => (
                <option key={block.id} value={block.id}>
                  {index + 1}. {blockTitle(block)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={attachToBlock}
              disabled={!attachBlockId}
            >
              Vincular escena
            </button>
            <button
              type="button"
              onClick={() =>
                createSessionBlockFromBoardScene(board.id, scene.id)
              }
            >
              Crear bloque desde escena
            </button>
          </section>

          {payload ? (
            <section className="rombo-payload">
              <h2>Payload listo</h2>
              <pre>{JSON.stringify(payload, null, 2)}</pre>
            </section>
          ) : null}
        </aside>
      </main>

      <footer className="rombo-board-footer">
        <select
          value={scene.id}
          onChange={(event) => openTacticalBoard(board.id, event.target.value)}
        >
          {board.scenes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <button type="button" onClick={addScene}>
          +
        </button>
        <span>Pizarra de planificacion</span>
        <strong>Anotaciones para generar secuencias</strong>
        <span>{status}</span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(80, value - 10))}
        >
          -
        </button>
        <span>{zoom}%</span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(130, value + 10))}
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            reorderTacticalBoardScenes(
              board.id,
              Math.max(
                0,
                board.scenes.findIndex((item) => item.id === scene.id) - 1,
              ),
              board.scenes.findIndex((item) => item.id === scene.id),
            )
          }
        >
          Mover escena
        </button>
      </footer>
    </section>
  );
}

function TacticalPitch({
  refEl,
  scene,
  selected,
  color,
  lineWidth,
  tool,
  activeLayers,
  zoom,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  refEl: MutableRefObject<SVGSVGElement | null>;
  scene: BoardScene;
  selected: Selection;
  color: string;
  lineWidth: number;
  tool: BoardTool;
  activeLayers: Set<string>;
  zoom: number;
  onSelect: (selection: Selection) => void;
  onPointerDown: (point: BoardPoint, targetId?: string) => void;
  onPointerMove: (point: BoardPoint) => void;
  onPointerUp: () => void;
}) {
  const visibleObjects = scene.objects.filter((object) => {
    if (object.type === "opponentToken" && !activeLayers.has("defense"))
      return false;
    if (object.type === "note" && !activeLayers.has("attack")) return false;
    return true;
  });
  const visibleArrows = scene.arrows.filter((arrow) =>
    layerVisibleForArrow(arrow, activeLayers),
  );
  const visibleZones = scene.zones.filter((zone) =>
    zoneVisible(zone.semantic, activeLayers),
  );

  const pointFromEvent = (event: PointerEvent<SVGSVGElement>): BoardPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  return (
    <svg
      ref={refEl}
      className="rombo-pitch-svg"
      viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
      style={{ transform: `scale(${zoom / 100})` }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("[data-board-target]")) return;
        onPointerDown(pointFromEvent(event));
      }}
      onPointerMove={(event) => onPointerMove(pointFromEvent(event))}
      onPointerUp={onPointerUp}
      role="img"
      aria-label="Cancha tactica interactiva"
    >
      <defs>
        <marker
          id="rombo-arrow-head"
          markerWidth="4"
          markerHeight="4"
          refX="3"
          refY="2"
          orient="auto"
        >
          <path d="M0,0 L4,2 L0,4 Z" fill={color} />
        </marker>
      </defs>
      <rect width="100" height="64" rx="1.5" className="pitch-bg" />
      <path
        d="M5 5H95V59H5Z M50 5V59 M5 21H17V43H5 M95 21H83V43H95 M5 27H10V37H5 M95 27H90V37H95"
        className="pitch-lines"
      />
      <circle cx="50" cy="32" r="8" className="pitch-lines-fill" />
      <circle cx="50" cy="32" r="0.45" className="pitch-dot" />

      {visibleZones.map((zone) => (
        <g
          key={zone.id}
          data-board-target
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect({ kind: "zone", id: zone.id });
          }}
        >
          {zone.shape === "circle" ? (
            <ellipse
              cx={zone.x + zone.w / 2}
              cy={zone.y + zone.h / 2}
              rx={zone.w / 2}
              ry={zone.h / 2}
              fill={zone.color}
              className="board-zone"
            />
          ) : (
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx="1.2"
              fill={zone.color}
              className="board-zone"
            />
          )}
          <text x={zone.x + 1.2} y={zone.y + 3.2} className="board-zone-label">
            {zone.label}
          </text>
        </g>
      ))}

      {visibleArrows.map((arrow) => {
        const start = endpointPoint(arrow.from, scene.objects);
        const end = endpointPoint(arrow.to, scene.objects);
        const curved =
          arrow.semantic === "run" || arrow.semantic === "rotation";
        const d = curved
          ? `M${start.x} ${scaleY(start.y)} Q${(start.x + end.x) / 2} ${scaleY(start.y - 16)} ${end.x} ${scaleY(end.y)}`
          : `M${start.x} ${scaleY(start.y)} L${end.x} ${scaleY(end.y)}`;
        return (
          <g
            key={arrow.id}
            data-board-target
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect({ kind: "arrow", id: arrow.id });
            }}
          >
            <path
              d={d}
              className={`board-arrow ${arrow.semantic}`}
              stroke={arrow.style?.color ?? color}
              strokeWidth={lineWidth * 0.35}
              markerEnd="url(#rombo-arrow-head)"
            />
            {arrow.label ? (
              <text
                x={(start.x + end.x) / 2}
                y={scaleY((start.y + end.y) / 2) - 1.4}
                className="board-arrow-label"
              >
                {arrow.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {visibleObjects.map((object) => (
        <BoardObjectNode
          key={object.id}
          object={object}
          selected={selected?.kind === "object" && selected.id === object.id}
          onSelect={(id) => onSelect({ kind: "object", id })}
          onPointerDown={(event, id) => {
            event.stopPropagation();
            onPointerDown(pointFromSvgEvent(event), id);
          }}
        />
      ))}
    </svg>
  );
}

function BoardObjectNode({
  object,
  selected,
  onSelect,
  onPointerDown,
}: {
  object: BoardObject;
  selected: boolean;
  onSelect: (id: string) => void;
  onPointerDown: (event: PointerEvent<SVGGElement>, id: string) => void;
}) {
  const x = object.position.x;
  const y = scaleY(object.position.y);
  if (object.type === "ball") {
    return (
      <g
        data-board-target
        onPointerDown={(event) => onPointerDown(event, object.id)}
      >
        <circle
          cx={x}
          cy={y}
          r="1.2"
          className={selected ? "ball selected" : "ball"}
        />
      </g>
    );
  }
  if (object.type === "note") {
    return (
      <g
        data-board-target
        onPointerDown={(event) => onPointerDown(event, object.id)}
      >
        <rect
          x={x}
          y={y - 4}
          width="17"
          height="7"
          rx="1.2"
          className={selected ? "note selected" : "note"}
        />
        <text x={x + 1.2} y={y - 1.4} className="note-text">
          {object.label}
        </text>
      </g>
    );
  }
  if (object.type === "equipmentMarker") {
    return (
      <g
        data-board-target
        onPointerDown={(event) => onPointerDown(event, object.id)}
      >
        <rect
          x={x - 1.6}
          y={y - 1.6}
          width="3.2"
          height="3.2"
          rx=".4"
          className={selected ? "equipment selected" : "equipment"}
        />
        <text x={x + 2.2} y={y + 1} className="equipment-label">
          {object.label}
        </text>
      </g>
    );
  }
  const rival = object.type === "opponentToken";
  return (
    <g
      data-board-target
      onPointerDown={(event) => onPointerDown(event, object.id)}
    >
      <circle
        cx={x}
        cy={y}
        r="2.15"
        className={`${rival ? "token rival" : "token own"} ${selected ? "selected" : ""}`}
      />
      <text x={x} y={y + 0.7} className="token-number">
        {object.number ?? ""}
      </text>
      <text x={x} y={y + 4.4} className="token-name">
        {shortName(object.label)}
      </text>
    </g>
  );
}

function ToolIcon({ tool }: { tool: BoardTool }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: "img",
    "aria-label": labelForTool(tool),
  };

  if (tool === "select") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M5 4l11 8-5 1.4 3 5.2-2.7 1.5-3-5.1-3.3 3z" />
      </svg>
    );
  }
  if (tool === "move") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M12 3v18M3 12h18M12 3l3 3M12 3L9 6M21 12l-3 3M21 12l-3-3M12 21l3-3M12 21l-3-3M3 12l3 3M3 12l3-3" />
      </svg>
    );
  }
  if (tool === "pencil") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 20l4.2-1 10-10a2.2 2.2 0 0 0-3.1-3.1l-10 10z" />
        <path d="M13.8 7.2l3 3" />
      </svg>
    );
  }
  if (tool === "line") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M5 19L19 5" />
      </svg>
    );
  }
  if (tool === "arrow" || tool === "longPass" || tool === "cross") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 18L18 6" />
        <path d="M12 6h6v6" />
      </svg>
    );
  }
  if (tool === "ballRoute") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 17c5-8 10 2 16-6" strokeDasharray="2 2" />
        <circle cx="5" cy="17" r="1.5" />
      </svg>
    );
  }
  if (tool === "run") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 18c4-10 11 0 16-10" />
        <path d="M15 7h5v5" />
      </svg>
    );
  }
  if (tool === "pressureLine") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M4 7h16M4 12h12M4 17h8" />
        <path d="M17 12l3-3M17 12l3 3" />
      </svg>
    );
  }
  if (tool === "zone" || tool === "block") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <rect x="4" y="6" width="16" height="12" rx="2" />
        {tool === "block" ? <path d="M8 10h8M8 14h8" /> : null}
      </svg>
    );
  }
  if (tool === "text") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M5 6h14M12 6v12M9 18h6" />
      </svg>
    );
  }
  if (tool === "cone") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M12 5l5 14H7z" />
        <path d="M8.5 15h7" />
      </svg>
    );
  }
  if (tool === "goal") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <path d="M5 18V7h14v11" />
        <path d="M5 11h14M9 7v11M15 7v11" />
      </svg>
    );
  }
  if (tool === "mannequin") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v10M8 11h8M9 21h6" />
      </svg>
    );
  }
  if (tool === "shot") {
    return (
      <svg {...common}>
        <title>{labelForTool(tool)}</title>
        <circle cx="6" cy="17" r="2" />
        <path d="M8 15l10-8" />
        <path d="M14 6h5v5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <title>{labelForTool(tool)}</title>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function readWorkspace(boardId: string): {
  roster: PlanningBoardPlayer[];
  problem: TacticalProblem;
  exercise: ExerciseBuilder;
  layers: PlanningBoardLayer[];
  currentView: CurrentBoardView;
  teamAFormation: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}-${boardId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeWorkspace(
  boardId: string,
  value: {
    roster: PlanningBoardPlayer[];
    problem: TacticalProblem;
    exercise: ExerciseBuilder;
    layers: PlanningBoardLayer[];
    currentView: CurrentBoardView;
    teamAFormation: string;
  },
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${STORAGE_PREFIX}-${boardId}`,
    JSON.stringify(value),
  );
}
