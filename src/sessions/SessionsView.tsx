import { catalog } from "@/data";
import type { Session } from "@/data";
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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { useMemo, useState } from "react";
import { computeMicrocycleAlerts } from "./MicrocycleAlerts";

type DragMeta =
  | { type: "exercise"; exerciseId: string }
  | { type: "block"; blockId: string }
  | null;

export function SessionsView() {
  const session = useAppStore((state) => state.session);
  const microcycle = useAppStore((state) => state.microcycle);
  const addToSession = useAppStore((state) => state.addToSession);
  const reorderSessionBlocks = useAppStore(
    (state) => state.reorderSessionBlocks,
  );
  const [dragMeta, setDragMeta] = useState<DragMeta>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const computed = session.computed ?? recomputeFallback(session.blocks);
  const alerts = useMemo(
    () =>
      computeMicrocycleAlerts(microcycle, { ...session, computed }, catalog),
    [microcycle, session, computed],
  );

  const blockIds = useMemo(
    () => session.blocks.map((block) => block.id),
    [session.blocks],
  );

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
          const oldIndex = session.blocks.findIndex(
            (block) => block.id === activeId,
          );
          const newIndex = session.blocks.findIndex(
            (block) => block.id === overId,
          );
          if (oldIndex !== -1 && newIndex !== -1) {
            const next = arrayMove(session.blocks, oldIndex, newIndex);
            useAppStore.getState().loadSnapshot({
              session: {
                ...session,
                blocks: next,
                computed: recomputeFallback(next),
              },
            });
          }
        }
        setDragMeta(null);
      }}
    >
      <section className="session-layout">
        <div className="team-card">
          <div className="section-title">
            <div>
              <span className="panel-eyebrow">Training day builder</span>
              <h3>Planificador de sesión</h3>
            </div>
            <button
              type="button"
              onClick={() => exportSessionPdf(session.blocks, computed)}
            >
              Exportar PDF
            </button>
          </div>
          <div className="session-summary" style={{ marginTop: 12 }}>
            <div className="summary-tile">
              <b>{session.blocks.length}</b>
              Ejercicios
            </div>
            <div className="summary-tile">
              <b>{computed.totalDuration}'</b>
              Duración
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
                  <p className="muted">
                    Arrastrá ejercicios desde la biblioteca.
                  </p>
                )}
              </div>
            </SortableContext>
          </DroppableSessionArea>
        </div>

        <div className="team-card">
          <span className="panel-eyebrow">Drag from catalog</span>
          <h3>Catálogo para arrastrar</h3>
          <p className="muted-panel">
            Soltá un ejercicio acá abajo para agregarlo a la sesión.
          </p>
          <div style={{ maxHeight: 680, overflow: "auto", paddingRight: 4 }}>
            {catalog.slice(0, 16).map((exercise) => (
              <ExerciseDraggable key={exercise.id} exerciseId={exercise.id} />
            ))}
          </div>
        </div>

        <div className="team-card">
          <span className="panel-eyebrow">Semana competitiva</span>
          <h3>Microciclo</h3>
          <div className="microcycle-grid" style={{ marginTop: 12 }}>
            {Object.entries(microcycle.days).map(([day, value]) => (
              <div className="micro-day" key={day}>
                <strong>{day}</strong>
                <p>{value.objective}</p>
                <small>{value.targetLoad}</small>
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

function ExerciseDraggable({ exerciseId }: { exerciseId: string }) {
  const exercise = catalog.find((item) => item.id === exerciseId);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: exerciseId,
      data: { type: "exercise", exerciseId } satisfies DragMeta,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    marginBottom: 10,
  } as const;

  if (!exercise) return null;

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
        {exercise.duration} min · {exercise.phase} · {exercise.principle}
      </small>
    </div>
  );
}

function SessionBlockCard({ id, index }: { id: string; index: number }) {
  const session = useAppStore((state) => state.session);
  const updateSessionBlock = useAppStore((state) => state.updateSessionBlock);
  const removeSessionBlock = useAppStore((state) => state.removeSessionBlock);
  const block = session.blocks.find((item) => item.id === id);
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as const;

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
            {exercise.phase} · {exercise.principle} · {exercise.intensity}
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
  const styles = StyleSheet.create({
    page: {
      padding: 28,
      fontSize: 11,
      fontFamily: "Helvetica",
      backgroundColor: "#071019",
      color: "#eff7fa",
    },
    title: { fontSize: 20, marginBottom: 12, color: "#f5c66f" },
    block: {
      padding: 10,
      border: "1 solid #31525d",
      borderRadius: 8,
      marginBottom: 8,
    },
    section: { marginTop: 12 },
    label: { color: "#5eead4", marginBottom: 4 },
  });

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Sesión Tactical Lab 3D</Text>
        <Text>Duración total: {computed.totalDuration} min</Text>
        <Text>Carga estimada: {computed.totalLoad}</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Objetivos primarios</Text>
          {computed.primaryObjectives.map((objective: string) => (
            <Text key={objective}>• {objective}</Text>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Bloques</Text>
          {blocks.map((block: Session["blocks"][number], index: number) => {
            const exercise = catalog.find(
              (item) => item.id === block.exerciseId,
            );
            return (
              <View key={block.id} style={styles.block}>
                <Text>
                  {index + 1}. {exercise?.title ?? block.exerciseId} -{" "}
                  {block.durationMin} min
                </Text>
                <Text>{exercise?.objective.primary}</Text>
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sesion-tactical-lab-3d.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
