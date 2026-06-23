import { catalog, generatedLibraryExerciseIds } from "@/data";
import type { Exercise, Session } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useMemo, useState } from "react";
import type { TacticalBoard } from "@/board";
import { computeMicrocycleAlerts } from "./MicrocycleAlerts";
import { PitchSideView } from "./PitchSideView";
import {
  LoadMeter,
  PitchViz,
  type PitchOverlay,
} from "@/ui/tacticalPrimitives";
import {
  QuickSketchLauncher,
  QuickSketchView,
  SketchThumbnail,
  buildContextualSketchDraft,
  buildQuickSketchTitle,
  type Sketch,
} from "@/sketch";

type DragMeta =
  | { type: "exercise"; exerciseId: string }
  | { type: "block"; blockId: string }
  | null;

type DrawerFilter = "all" | "favorites" | "recent" | "mine";

const DRAWER_FILTERS: { id: Exclude<DrawerFilter, "all">; label: string }[] = [
  { id: "favorites", label: "Favoritos" },
  { id: "recent", label: "Recientes" },
  { id: "mine", label: "Mis ejercicios" },
];

const SESSION_DRAWER_LIMIT = 60;

export function SessionsView() {
  const session = useAppStore((state) => state.session);
  const microcycle = useAppStore((state) => state.microcycle);
  const aiPrompt = useAppStore((state) => state.aiPrompt);
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const addToSession = useAppStore((state) => state.addToSession);
  const reorderSessionBlocks = useAppStore(
    (state) => state.reorderSessionBlocks,
  );
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const libraryFavoriteIds = useAppStore((state) => state.libraryFavoriteIds);
  const libraryRecentOpens = useAppStore((state) => state.libraryRecentOpens);
  const [dragMeta, setDragMeta] = useState<DragMeta>(null);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter>("all");
  const [pitchSideOpen, setPitchSideOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const computed = session.computed ?? recomputeFallback(session.blocks);
  const sessionIntent = useMemo(
    () => readSessionIntent(session.staffNotes, aiPrompt, weeklyDecisionThread),
    [aiPrompt, session.staffNotes, weeklyDecisionThread],
  );
  const alerts = useMemo(
    () =>
      computeMicrocycleAlerts(microcycle, { ...session, computed }, catalog),
    [microcycle, session, computed],
  );

  const blockIds = useMemo(
    () => session.blocks.map((block) => block.id),
    [session.blocks],
  );

  // El catalogo curado por si solo dejaba afuera ejercicios propios (creados
  // desde cero, duplicados, importados). Combinamos catalogo + variantes, como
  // hace LibraryView, para que lo que el coach ve en Biblioteca tambien
  // aparezca aca para arrastrar a la sesion.
  const drawerExercises = useMemo(() => {
    const visibleCatalog = catalog.filter(
      (exercise) => !generatedLibraryExerciseIds.has(exercise.id),
    );
    return [...visibleCatalog, ...exerciseVariants];
  }, [exerciseVariants]);
  const drawerFavoriteIdSet = useMemo(
    () => new Set(libraryFavoriteIds),
    [libraryFavoriteIds],
  );
  const drawerRecentIdSet = useMemo(
    () => new Set(libraryRecentOpens.slice(0, 8).map((entry) => entry.exerciseId)),
    [libraryRecentOpens],
  );
  const drawerMineIdSet = useMemo(
    () => new Set(exerciseVariants.map((exercise) => exercise.id)),
    [exerciseVariants],
  );
  const drawerCounts: Record<DrawerFilter, number> = {
    all: drawerExercises.length,
    favorites: drawerExercises.filter((exercise) => drawerFavoriteIdSet.has(exercise.id)).length,
    recent: drawerExercises.filter((exercise) => drawerRecentIdSet.has(exercise.id)).length,
    mine: drawerExercises.filter((exercise) => drawerMineIdSet.has(exercise.id)).length,
  };
  const drawerFiltered = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    return drawerExercises.filter((exercise) => {
      if (drawerFilter === "favorites" && !drawerFavoriteIdSet.has(exercise.id)) return false;
      if (drawerFilter === "recent" && !drawerRecentIdSet.has(exercise.id)) return false;
      if (drawerFilter === "mine" && !drawerMineIdSet.has(exercise.id)) return false;
      if (!q) return true;
      return [exercise.title, exercise.phase, exercise.principle, exercise.level]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [drawerExercises, drawerFavoriteIdSet, drawerFilter, drawerMineIdSet, drawerRecentIdSet, drawerSearch]);
  const drawerVisible = drawerFiltered.slice(0, SESSION_DRAWER_LIMIT);

  if (pitchSideOpen) {
    return <PitchSideView onExit={() => setPitchSideOpen(false)} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) =>
        setDragMeta((event.active.data.current as DragMeta) ?? null)
      }
      onDragCancel={() => setDragMeta(null)}
      onDragEnd={(event) => {
        const active = event.active.data.current as DragMeta;
        const over = event.over?.data.current as DragMeta | undefined;
        const overId = event.over?.id ? String(event.over.id) : null;

        if (active?.type === "exercise" && overId) {
          addToSession(active.exerciseId);
        }

        if (
          active?.type === "block" &&
          over?.type === "block" &&
          overId &&
          event.active.id !== overId
        ) {
          const activeId = String(event.active.id);
          reorderSessionBlocks(activeId, overId);
        }
        setDragMeta(null);
      }}
    >
      <section className="session-layout">
        <div className="team-card">
          <div className="section-title">
            <div>
              <span className="panel-eyebrow">Diagnostico -&gt; campo</span>
              <h3>Sesion como respuesta tactica</h3>
            </div>
            <div className="toolbar compact" style={{ marginBottom: 0 }}>
              <QuickSketchLauncher
                buttonClassName="secondary"
                buttonLabel="Boceto rapido"
                buttonTitle="Abrir un boceto rapido desde Sesion"
                panelTitle="Boceto rapido para la sesion"
                buildDraft={() =>
                  buildContextualSketchDraft({
                    title: buildQuickSketchTitle([
                      "Boceto",
                      session.name,
                      sessionIntent.problem,
                    ]),
                    tacticalFocus: sessionIntent.objective,
                    sourceLabel: session.blocks.length
                      ? `Sesion ${session.name || "semanal"}`
                      : "Sesion desde foco semanal",
                  })
                }
              />
              <button
                type="button"
                className="secondary"
                disabled={!session.blocks.length}
                onClick={() => setPitchSideOpen(true)}
              >
                Modo cancha
              </button>
              <button
                type="button"
                onClick={() => void exportSessionPdf(session.blocks, computed)}
              >
                Exportar PDF
              </button>
            </div>
          </div>
          <div className="session-origin-card">
            <span className="eyebrow">Foco semanal</span>
            <h4>{shorten(sessionIntent.problem, 110)}</h4>
            <div className="session-intent-grid compact">
              <div className="session-intent-item">
                <span>Objetivo</span>
                <b>{sessionIntent.objective}</b>
              </div>
              <div className="session-intent-item">
                <span>Senal de exito</span>
                <b>{sessionIntent.successSignal}</b>
              </div>
              <div className="session-intent-item">
                <span>Revision partido</span>
                <b>{sessionIntent.nextReview}</b>
              </div>
            </div>
          </div>
          <div className="session-summary" style={{ marginTop: 12 }}>
            <div className="summary-tile">
              <b>{session.blocks.length}</b>
              Ejercicios
            </div>
            <div className="summary-tile">
              <b>{computed.totalDuration}'</b>
              Duracion
            </div>
            <div className="summary-tile">
              <b>{computed.totalLoad}</b>
              Carga
            </div>
          </div>
          <DroppableSessionArea id="session-dropzone">
            <SortableContext
              items={blockIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="session-blocks">
                {session.blocks.length ? (
                  session.blocks.map((block, index) => (
                    <SessionBlockCard
                      key={block.id}
                      id={block.id}
                      index={index}
                    />
                  ))
                ) : (
                  <div className="muted-panel">
                    <p style={{ marginTop: 0 }}>
                      Arrastra ejercicios desde Biblioteca o crea un borrador
                      guiado desde el foco semanal.
                    </p>
                    <div className="toolbar compact" style={{ marginBottom: 0, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => useAppStore.getState().createSessionFromWeeklyThread()}
                      >
                        Crear sesion desde foco semanal
                      </button>
                      <QuickSketchLauncher
                        buttonClassName="secondary"
                        buttonLabel="Boceto rapido"
                        buttonTitle="Abrir un boceto rapido desde Sesion"
                        panelTitle="Boceto rapido para la sesion"
                        buildDraft={() =>
                          buildContextualSketchDraft({
                            title: buildQuickSketchTitle([
                              "Boceto",
                              sessionIntent.problem,
                            ]),
                            tacticalFocus: sessionIntent.objective,
                            sourceLabel: "Sesion vacia",
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </SortableContext>
          </DroppableSessionArea>
        </div>

        <div className="team-card">
          <span className="panel-eyebrow">Ejercicios disponibles</span>
          <h3>Catalogo para arrastrar</h3>
          <p className="muted-panel">
            Arrastra solo lo que responda al foco semanal.
          </p>
          <input
            type="search"
            className="session-drawer-search"
            placeholder="Buscar por titulo, fase o principio..."
            value={drawerSearch}
            onChange={(event) => setDrawerSearch(event.target.value)}
            aria-label="Buscar ejercicios para la sesion"
          />
          <div className="session-drawer-filters">
            {DRAWER_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`smart-filter-chip ${drawerFilter === filter.id ? "active" : ""}`.trim()}
                onClick={() =>
                  setDrawerFilter((current) => (current === filter.id ? "all" : filter.id))
                }
              >
                {filter.label} <span>{drawerCounts[filter.id]}</span>
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 620, overflow: "auto", paddingRight: 4 }}>
            {drawerVisible.length ? (
              drawerVisible.map((exercise) => (
                <ExerciseDraggable key={exercise.id} exercise={exercise} />
              ))
            ) : (
              <p className="muted">
                Sin resultados para esta busqueda o filtro. Probá limpiar la
                busqueda o elegir "Mis ejercicios".
              </p>
            )}
          </div>
          {drawerFiltered.length > drawerVisible.length && (
            <p className="muted session-drawer-hint">
              Mostrando {drawerVisible.length} de {drawerFiltered.length}. Afina
              la busqueda para encontrar mas rapido.
            </p>
          )}
        </div>

        <div className="team-card">
          <span className="panel-eyebrow">Semana competitiva</span>
          <h3>Microciclo</h3>
          <div className="microcycle-grid" style={{ marginTop: 12 }}>
            {Object.entries(microcycle.days).map(([day, value]) => (
              <div className="micro-day" key={day}>
                <strong>{day}</strong>
                <p>{value.objective}</p>
                <LoadMeter load={value.targetLoad} label={day} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <h4>Alertas</h4>
            {alerts.length ? (
              alerts.map((alert) => (
                <div
                  className={`alert-row ${alert.severity}`}
                  key={alert.message}
                >
                  {alert.message}
                </div>
              ))
            ) : (
              <p className="muted">Sin alertas relevantes.</p>
            )}
          </div>
          <div className="toolbar" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              Imprimir vista
            </button>
          </div>
        </div>
      </section>
      <DragOverlay>
        {dragMeta?.type === "exercise" ? (
          <div className="exercise-card" style={{ width: 260, minHeight: 120 }}>
            Soltar para agregar
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const ExerciseDraggable = memo(function ExerciseDraggable({
  exercise,
}: { exercise: Exercise }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: exercise.id,
      data: { type: "exercise", exerciseId: exercise.id } satisfies DragMeta,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    marginBottom: 10,
  } as const;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="lineup-item"
    >
      <b>{exercise.title}</b>
      <br />
      <small>
        {exercise.duration} min - {exercise.phase} - {exercise.principle}
      </small>
    </div>
  );
});

const SessionBlockCard = memo(function SessionBlockCard({
  id,
  index,
}: { id: string; index: number }) {
  const block = useAppStore((state) =>
    state.session.blocks.find((item) => item.id === id),
  );
  const diagnosisPrompt = useAppStore((state) => state.aiPrompt);
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const updateSessionBlock = useAppStore((state) => state.updateSessionBlock);
  const removeSessionBlock = useAppStore((state) => state.removeSessionBlock);
  const sketches = useAppStore((state) => state.sketches);
  const createSketch = useAppStore((state) => state.createSketch);
  const updateSketch = useAppStore((state) => state.updateSketch);
  const attachSketchToSessionBlock = useAppStore((state) => state.attachSketchToSessionBlock);
  const detachSketchFromSessionBlock = useAppStore((state) => state.detachSketchFromSessionBlock);
  const tacticalBoards = useAppStore((state) => state.tacticalBoards);
  const attachBoardToSessionBlock = useAppStore((state) => state.attachBoardToSessionBlock);
  const detachBoardFromSessionBlock = useAppStore((state) => state.detachBoardFromSessionBlock);
  const createSessionBlockFromBoardScene = useAppStore((state) => state.createSessionBlockFromBoardScene);
  const [pendingAttachId, setPendingAttachId] = useState("");
  const [pendingBoardAttachId, setPendingBoardAttachId] = useState("");
  const [editingSketch, setEditingSketch] = useState<Sketch | null>(null);
  const exercise = catalog.find((item) => item.id === block?.exerciseId);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: "block", blockId: id } satisfies DragMeta,
  });

  if (!block || !exercise) return null;

  const previewOverlays: PitchOverlay[] = [
    {
      type: "zone",
      x: exercise.phase.includes("attack") ? 58 : 24,
      y: 18,
      w: 28,
      h: 28,
      tone:
        exercise.intensity === "high" || exercise.intensity === "veryHigh"
          ? "warn"
          : "info",
      label: exercise.principle.slice(0, 12),
    },
  ];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as const;
  const blockIntent = readSessionBlockIntent(
    block.notes,
    exercise,
    diagnosisPrompt,
    weeklyDecisionThread,
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="session-block"
      {...attributes}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr auto",
          gap: 10,
          alignItems: "start",
        }}
        {...listeners}
      >
        <strong>{index + 1}</strong>
        <div>
          <b>{exercise.title}</b>
          <br />
          <small>
            {exercise.phase} - {exercise.principle} - {exercise.intensity}
          </small>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => removeSessionBlock(block.id)}
        >
          Quitar
        </button>
      </div>
      <PitchViz
        compact
        title="Preview tactico"
        subtitle={`${exercise.phase} / ${exercise.principle}`}
        overlays={previewOverlays}
      />
      <div className="session-intent-grid">
        <div className="session-intent-item">
          <span>Problema</span>
          <b>{blockIntent.problem}</b>
        </div>
        <div className="session-intent-item">
          <span>Objetivo</span>
          <b>{blockIntent.objective}</b>
        </div>
        <div className="session-intent-item">
          <span>Senal</span>
          <b>{blockIntent.successSignal}</b>
        </div>
        <div className="session-intent-item">
          <span>Revision</span>
          <b>{blockIntent.nextReview}</b>
        </div>
      </div>
      <SessionBlockSketch
        block={block}
        exerciseTitle={exercise.title}
        sketches={sketches}
        pendingAttachId={pendingAttachId}
        onPendingAttachChange={setPendingAttachId}
        onAttach={(sketchId) => {
          attachSketchToSessionBlock(block.id, sketchId);
          setPendingAttachId("");
        }}
        onDetach={() => detachSketchFromSessionBlock(block.id)}
        onEdit={(sketch) => setEditingSketch(sketch)}
        onCreate={() => {
          const id = createSketch({ title: `Boceto - ${exercise.title}` });
          attachSketchToSessionBlock(block.id, id);
          const created = useAppStore.getState().sketches.find((entry) => entry.id === id);
          if (created) setEditingSketch(created);
        }}
      />
      <SessionBlockBoard
        block={block}
        boards={tacticalBoards}
        pendingAttachId={pendingBoardAttachId}
        onPendingAttachChange={setPendingBoardAttachId}
        onAttach={(boardId, sceneId) => {
          attachBoardToSessionBlock(block.id, boardId, sceneId);
          setPendingBoardAttachId("");
        }}
        onDetach={() => detachBoardFromSessionBlock(block.id)}
        onOpen={(boardId, sceneId) => useAppStore.getState().openTacticalBoard(boardId, sceneId)}
        onCreateBlock={(boardId, sceneId) => createSessionBlockFromBoardScene(boardId, sceneId)}
      />
      {editingSketch && (
        <div className="session-sketch-editor">
          <QuickSketchView
            sketch={editingSketch}
            onSave={(sketch) => {
              updateSketch(sketch.id, sketch);
              setEditingSketch(null);
            }}
            onCancel={() => setEditingSketch(null)}
          />
        </div>
      )}
      <div className="toolbar">
        <input
          type="number"
          min={1}
          value={block.durationMin}
          style={{ width: 88 }}
          onChange={(event) =>
            updateSessionBlock(block.id, {
              durationMin: Number(event.target.value),
            })
          }
        />
        <span className="muted">RPE {exercise.rpe}</span>
      </div>
    </div>
  );
});

type SessionBlockSketchProps = {
  block: Session["blocks"][number];
  exerciseTitle: string;
  sketches: Sketch[];
  pendingAttachId: string;
  onPendingAttachChange: (id: string) => void;
  onAttach: (sketchId: string) => void;
  onDetach: () => void;
  onEdit: (sketch: Sketch) => void;
  onCreate: () => void;
};

/**
 * Sketch attachment affordance for a session block: shows the attached
 * sketch's preview, or lets the coach attach an existing one / create a new
 * one inline. Quick Sketch stays a clearly secondary, opt-in surface here —
 * it never replaces the block's tactical-problem/objective/review summary.
 */
function SessionBlockSketch({
  block,
  exerciseTitle,
  sketches,
  pendingAttachId,
  onPendingAttachChange,
  onAttach,
  onDetach,
  onEdit,
  onCreate,
}: SessionBlockSketchProps) {
  const attachedSketch = block.sketchId
    ? sketches.find((entry) => entry.id === block.sketchId) ?? null
    : null;
  const otherSketches = sketches.filter((entry) => entry.id !== block.sketchId);

  return (
    <div className="session-sketch-block">
      <div className="session-sketch-header">
        <span>Boceto del bloque</span>
        {attachedSketch && (
          <div className="session-sketch-actions">
            <button type="button" className="link-btn" onClick={() => onEdit(attachedSketch)}>
              Editar
            </button>
            <button type="button" className="link-btn" onClick={onDetach}>
              Quitar
            </button>
          </div>
        )}
      </div>

      {attachedSketch ? (
        <div className="session-sketch-preview-row">
          <SketchThumbnail sketch={attachedSketch} className="session-sketch-thumb" />
          <div className="session-sketch-meta">
            <b>{attachedSketch.title}</b>
            <small className="muted">
              {attachedSketch.tokens.length} jugadores - {attachedSketch.annotations.length} anotaciones
            </small>
          </div>
        </div>
      ) : (
        <div className="session-sketch-attach-row">
          {otherSketches.length > 0 && (
            <>
              <select
                value={pendingAttachId}
                onChange={(event) => onPendingAttachChange(event.target.value)}
                aria-label="Elegir un boceto existente para adjuntar"
              >
                <option value="">Elegir boceto existente...</option>
                {otherSketches.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                disabled={!pendingAttachId}
                onClick={() => onAttach(pendingAttachId)}
              >
                Adjuntar
              </button>
            </>
          )}
          <button type="button" className="secondary" onClick={onCreate}>
            Crear boceto para "{exerciseTitle}"
          </button>
        </div>
      )}
    </div>
  );
}

type SessionBlockBoardProps = {
  block: Session["blocks"][number];
  boards: TacticalBoard[];
  pendingAttachId: string;
  onPendingAttachChange: (id: string) => void;
  onAttach: (boardId: string, sceneId?: string) => void;
  onDetach: () => void;
  onOpen: (boardId: string, sceneId?: string) => void;
  onCreateBlock: (boardId: string, sceneId: string) => void;
};

function SessionBlockBoard({
  block,
  boards,
  pendingAttachId,
  onPendingAttachChange,
  onAttach,
  onDetach,
  onOpen,
  onCreateBlock,
}: SessionBlockBoardProps) {
  const attachedBoard = block.boardId
    ? boards.find((entry) => entry.id === block.boardId) ?? null
    : null;
  const attachedScene = attachedBoard && block.boardSceneId
    ? attachedBoard.scenes.find((scene) => scene.id === block.boardSceneId) ?? null
    : null;
  const selectedPendingBoard = boards.find((entry) => entry.id === pendingAttachId) ?? null;
  const [pendingSceneId, setPendingSceneId] = useState("");
  const selectedPendingScene = selectedPendingBoard?.scenes.find((scene) => scene.id === pendingSceneId) ?? null;
  const effectivePendingScene = selectedPendingScene ?? selectedPendingBoard?.scenes[0] ?? null;

  return (
    <div className="session-sketch-block session-board-block">
      <div className="session-sketch-header">
        <span>Pizarra tactica del bloque</span>
        {attachedBoard ? (
          <div className="session-sketch-actions">
            <button
              type="button"
              className="link-btn"
              disabled={!attachedScene}
              onClick={() => attachedScene && onOpen(attachedBoard.id, attachedScene.id)}
            >
              Abrir
            </button>
            <button type="button" className="link-btn" onClick={onDetach}>
              Quitar
            </button>
          </div>
        ) : null}
      </div>

      {attachedBoard ? (
        <div className="session-board-preview-row">
          {attachedScene ? <BoardMiniPreview board={attachedBoard} sceneId={attachedScene.id} /> : null}
          <div className="session-sketch-meta">
            <b>{attachedBoard.title}</b>
            {attachedScene ? (
              <>
                <small className="muted">
                  {attachedScene.title} - {attachedScene.phaseLabel}
                </small>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => onCreateBlock(attachedBoard.id, attachedScene.id)}
                >
                  Crear bloque desde esta escena
                </button>
              </>
            ) : (
              <small className="muted">
                La escena vinculada ya no existe. Elegi otra escena o quitá la pizarra.
              </small>
            )}
          </div>
        </div>
      ) : (
        <div className="session-sketch-attach-row">
          {boards.length ? (
            <>
              <select
                value={pendingAttachId}
                onChange={(event) => {
                  onPendingAttachChange(event.target.value);
                  setPendingSceneId("");
                }}
                aria-label="Elegir una pizarra tactica para adjuntar"
              >
                <option value="">Elegir pizarra tactica...</option>
                {boards.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
              {selectedPendingBoard ? (
                <select
                  value={effectivePendingScene?.id ?? ""}
                  onChange={(event) => setPendingSceneId(event.currentTarget.value)}
                  aria-label="Elegir escena de pizarra para adjuntar"
                >
                  {selectedPendingBoard.scenes.map((scene, index) => (
                    <option key={scene.id} value={scene.id}>
                      {index + 1}. {scene.title} - {scene.phaseLabel}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                className="secondary"
                disabled={!selectedPendingBoard || !effectivePendingScene}
                onClick={() =>
                  selectedPendingBoard &&
                  effectivePendingScene &&
                  onAttach(selectedPendingBoard.id, effectivePendingScene.id)
                }
              >
                Adjuntar
              </button>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No hay pizarras tacticas creadas todavia.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BoardMiniPreview({
  board,
  sceneId,
}: {
  board: TacticalBoard;
  sceneId: string;
}) {
  const scene = board.scenes.find((entry) => entry.id === sceneId) ?? board.scenes[0];
  if (!scene) return null;
  return (
    <svg className="session-board-thumb" viewBox="0 0 100 64" role="img" aria-label={`${board.title} ${scene.title}`}>
      <rect width="100" height="64" rx="1.4" fill="#071b14" />
      <g fill="none" stroke="rgba(229,255,247,.42)" strokeWidth=".4">
        <rect x="2" y="2" width="96" height="60" />
        <line x1="50" y1="2" x2="50" y2="62" />
        <circle cx="50" cy="32" r="7.5" />
      </g>
      {scene.zones.slice(0, 4).map((zone) => (
        <rect
          key={zone.id}
          x={zone.x}
          y={(zone.y / 100) * 64}
          width={zone.w}
          height={(zone.h / 100) * 64}
          rx="1"
          fill={`${zone.color}33`}
          stroke={zone.color}
          strokeWidth=".5"
        />
      ))}
      {scene.arrows.slice(0, 8).map((arrow) => {
        const fromEndpoint = arrow.from;
        const toEndpoint = arrow.to;
        const from = fromEndpoint.kind === "point"
          ? fromEndpoint.point
          : scene.objects.find((object) => object.id === fromEndpoint.objectId)?.position;
        const to = toEndpoint.kind === "point"
          ? toEndpoint.point
          : scene.objects.find((object) => object.id === toEndpoint.objectId)?.position;
        if (!from || !to) return null;
        return (
          <line
            key={arrow.id}
            x1={from.x}
            y1={(from.y / 100) * 64}
            x2={to.x}
            y2={(to.y / 100) * 64}
            stroke={arrow.semantic === "pressure" ? "#ff7474" : "#5eead4"}
            strokeWidth=".75"
          />
        );
      })}
      {scene.objects.map((object) => (
        <circle
          key={object.id}
          cx={object.position.x}
          cy={(object.position.y / 100) * 64}
          r={object.type === "ball" ? 1.3 : 2.2}
          fill={object.type === "opponentToken" ? "#ff7474" : object.type === "ball" ? "#ffffff" : "#5eead4"}
        />
      ))}
    </svg>
  );
}

function DroppableSessionArea({
  id,
  children,
}: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "dropzone", zone: id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        outline: isOver ? "2px solid rgba(94, 234, 212, 0.4)" : "none",
        borderRadius: 16,
      }}
    >
      {children}
    </div>
  );
}

function recomputeFallback(blocks: Session["blocks"]) {
  const materials = new Map<
    string,
    { name: string; qty: number; unit: string }
  >();
  const objectives = new Set<string>();
  let totalDuration = 0;
  let totalLoad = 0;

  for (const block of blocks) {
    const exercise = catalog.find((item) => item.id === block.exerciseId);
    if (!exercise) continue;
    totalDuration += block.durationMin;
    totalLoad += block.durationMin * exercise.rpe;
    objectives.add(exercise.objective.primary);
    for (const material of exercise.material) {
      const existing = materials.get(material.name);
      if (!existing) materials.set(material.name, { ...material });
      else existing.qty += material.qty;
    }
  }

  return {
    totalDuration,
    totalLoad,
    materials: Array.from(materials.values()),
    primaryObjectives: Array.from(objectives),
  };
}

async function exportSessionPdf(
  blocks: Session["blocks"],
  computed: NonNullable<Session["computed"]>,
) {
  // Diferimos @react-pdf/renderer: solo se carga al exportar.
  const { exportSessionPdf: runExport } = await import("./sessionPdf");
  await runExport(blocks, computed);
}

function shorten(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

export function readSessionIntent(
  staffNotes: string | undefined,
  aiPrompt: string,
  weeklyDecisionThread: ReturnType<typeof useAppStore.getState>["weeklyDecisionThread"],
) {
  const threadIntent = weeklyDecisionThread?.sessionIntent;
  return {
    problem:
      threadIntent?.problem ||
      weeklyDecisionThread?.problem ||
      extractTaggedNote(staffNotes, "Problema semanal") ||
      extractTaggedNote(staffNotes, "Causa probable") ||
      aiPrompt.trim() ||
      "Todavia no hay un diagnostico activo enlazado a esta sesion.",
    objective:
      threadIntent?.objective ||
      extractTaggedNote(staffNotes, "Objetivo tactico") ||
      "Transformar el problema tactico en una respuesta entrenable.",
    successSignal:
      threadIntent?.successSignal ||
      extractTaggedNote(staffNotes, "Senales del sabado") ||
      "Definir que comportamiento debe aparecer en el siguiente partido.",
    nextReview:
      threadIntent?.reviewCriteria ||
      extractTaggedNote(staffNotes, "Test de miercoles") ||
      "Revisar el ajuste en el siguiente partido.",
  };
}

export function readSessionBlockIntent(
  notes: string | undefined,
  exercise: Exercise,
  aiPrompt: string,
  weeklyDecisionThread: ReturnType<typeof useAppStore.getState>["weeklyDecisionThread"],
) {
  const threadIntent = weeklyDecisionThread?.sessionIntent;
  return {
    problem:
      extractTaggedNote(notes, "Problema") ||
      threadIntent?.problem ||
      weeklyDecisionThread?.problem ||
      aiPrompt.trim() ||
      "Problema a validar.",
    objective:
      extractTaggedNote(notes, "Objetivo") ||
      threadIntent?.objective ||
      exercise.objective.primary,
    successSignal:
      extractTaggedNote(notes, "Senal de exito") ||
      threadIntent?.successSignal ||
      exercise.success,
    nextReview:
      extractTaggedNote(notes, "Revision proximo partido") ||
      threadIntent?.reviewCriteria ||
      "Comparar si el patron mejora en el proximo partido.",
  };
}

function extractTaggedNote(notes: string | undefined, label: string) {
  if (!notes?.trim()) return "";
  const line = notes
    .split(/\r?\n/)
    .find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line?.split(":").slice(1).join(":").trim() ?? "";
}
