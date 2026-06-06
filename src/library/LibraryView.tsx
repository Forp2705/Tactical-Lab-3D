import { catalog, ExerciseSchema, generatedLibraryExerciseIds } from "@/data";
import { getExerciseById, useAppStore } from "@/state/useAppStore";
import { LoadMeter, PitchViz } from "@/ui/tacticalPrimitives";
import { useState } from "react";

type ImportFeedback = {
  type: "success" | "error";
  message: string;
};

export function LibraryView() {
  const [importDraft, setImportDraft] = useState("");
  const [importFeedback, setImportFeedback] = useState<ImportFeedback | null>(
    null,
  );
  const search = useAppStore((state) => state.search);
  const phase = useAppStore((state) => state.phase);
  const level = useAppStore((state) => state.level);
  const principle = useAppStore((state) => state.principle);
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const selectExercise = useAppStore((state) => state.selectExercise);
  const createExerciseVariantFrom = useAppStore(
    (state) => state.createExerciseVariantFrom,
  );
  const importExerciseVariant = useAppStore(
    (state) => state.importExerciseVariant,
  );
  const visibleCatalog = catalog.filter(
    (exercise) => !generatedLibraryExerciseIds.has(exercise.id),
  );
  const exercises = [...visibleCatalog, ...exerciseVariants];

  const filtered = exercises.filter((exercise) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [
          exercise.title,
          exercise.phase,
          exercise.principle,
          exercise.level,
          exercise.objective.primary,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (phase === "all" || exercise.phase === phase) &&
      (level === "all" || exercise.level === level) &&
      (principle === "all" || exercise.principle === principle)
    );
  });

  const selected = getExerciseById(selectedExerciseId);
  const selectedIsVariant = exerciseVariants.some(
    (exercise) => exercise.id === selected.id,
  );

  const handleCreateEditableCopy = () => {
    const id = createExerciseVariantFrom(selected.id, {
      title: `${selected.title} - editable`,
      authorNotes: "Copia editable desde biblioteca",
    });
    if (!id) {
      setImportFeedback({
        type: "error",
        message: "No se pudo crear la copia editable.",
      });
      return;
    }

    useAppStore.getState().setView("library");
    setImportFeedback({
      type: "success",
      message: "Copia editable creada en Mis jugadas.",
    });
  };

  const handleUseSelectedAsTemplate = () => {
    setImportDraft(
      JSON.stringify(
        {
          ...selected,
          id: `${selected.id}-custom`,
          title: `${selected.title} - propia`,
          authorNotes: [selected.authorNotes, "Plantilla local"]
            .filter(Boolean)
            .join(" | "),
        },
        null,
        2,
      ),
    );
    setImportFeedback(null);
  };

  const handleImportExercise = () => {
    const raw = importDraft.trim();
    if (!raw) {
      setImportFeedback({
        type: "error",
        message: "Pega una jugada en JSON antes de importar.",
      });
      return;
    }

    try {
      const payload = JSON.parse(raw);
      const result = ExerciseSchema.safeParse(payload);
      if (!result.success) {
        const issue = result.error.issues[0];
        setImportFeedback({
          type: "error",
          message: issue
            ? `${issue.path.join(".") || "exercise"}: ${issue.message}`
            : "La jugada no cumple el schema.",
        });
        return;
      }

      const id = importExerciseVariant(result.data);
      if (!id) {
        setImportFeedback({
          type: "error",
          message: "La jugada no pudo guardarse como variante.",
        });
        return;
      }

      setImportDraft("");
      setImportFeedback({
        type: "success",
        message: "Jugada importada en Mis jugadas.",
      });
    } catch {
      setImportFeedback({
        type: "error",
        message: "JSON invalido.",
      });
    }
  };

  return (
    <section className="library-layout">
      <div>
        <div className="coach-room-strip">
          <div>
            <span className="panel-eyebrow">Catalogo curado</span>
            <b>{filtered.length}</b>
            <small>ejercicios disponibles</small>
          </div>
          <div>
            <span className="panel-eyebrow">Foco activo</span>
            <b>{phase === "all" ? "TODAS" : phase}</b>
            <small>fase tactica</small>
          </div>
          <div>
            <span className="panel-eyebrow">Mis jugadas</span>
            <b>{exerciseVariants.length}</b>
            <small>variantes locales</small>
          </div>
          <div>
            <span className="panel-eyebrow">Criterio</span>
            <b>{principle === "all" ? "LIBRE" : principle}</b>
            <small>principio de juego</small>
          </div>
        </div>
        <div className="toolbar">
          <input
            className="grow"
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={(event) =>
              useAppStore.getState().setSearch(event.target.value)
            }
          />
          <select
            value={phase}
            onChange={(event) =>
              useAppStore.getState().setFilter("phase", event.target.value)
            }
          >
            <option value="all">Todas las fases</option>
            <option value="attackOrg">Ataque organizado</option>
            <option value="defenseOrg">Defensa organizada</option>
            <option value="transOff">Transición ofensiva</option>
            <option value="transDef">Transición defensiva</option>
            <option value="abpOff">ABP ofensiva</option>
            <option value="abpDef">ABP defensiva</option>
          </select>
          <select
            value={level}
            onChange={(event) =>
              useAppStore.getState().setFilter("level", event.target.value)
            }
          >
            <option value="all">Todos los niveles</option>
            <option value="U12+">U12+</option>
            <option value="U14+">U14+</option>
            <option value="U15+">U15+</option>
            <option value="U16+">U16+</option>
            <option value="U17+">U17+</option>
            <option value="U18+">U18+</option>
            <option value="Amateur+">Amateur+</option>
            <option value="Semi-pro">Semi-pro</option>
          </select>
          <select
            value={principle}
            onChange={(event) =>
              useAppStore.getState().setFilter("principle", event.target.value)
            }
          >
            <option value="all">Todos los principios</option>
            {Array.from(
              new Set(exercises.map((exercise) => exercise.principle)),
            ).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="exercise-grid">
          {filtered.map((exercise) => (
            <button
              type="button"
              key={exercise.id}
              className={`exercise-card ${exercise.id === selectedExerciseId ? "selected" : ""}`}
              onClick={() => selectExercise(exercise.id)}
            >
              <PitchViz
                compact
                title={exercise.phase}
                subtitle={exercise.principle}
                overlays={[
                  {
                    type: "zone",
                    x: exercise.phase.includes("attack") ? 58 : 20,
                    y: 18,
                    w: 28,
                    h: 28,
                    tone: exercise.rpe >= 7 ? "warn" : "info",
                    label: exercise.objective.primary.slice(0, 14),
                  },
                ]}
              />
              <div className="card-meta">
                <h3>{exercise.title}</h3>
                <span>{exercise.duration} min</span>
              </div>
              <div className="tags">
                {exerciseVariants.some((item) => item.id === exercise.id) ? (
                  <span className="tag custom-tag">propia</span>
                ) : null}
                <span className="tag">{exercise.phase}</span>
                <span className="tag">{exercise.principle}</span>
                <span className="tag">{exercise.level}</span>
                <span className="tag">
                  {exercise.players.min}-{exercise.players.max} jugadores
                </span>
              </div>
              <LoadMeter
                load={exercise.rpe >= 7 ? "high" : exercise.rpe >= 5 ? "med" : "low"}
                label={`RPE ${exercise.rpe}`}
              />
            </button>
          ))}
        </div>
      </div>
      <aside className="detail-panel">
        <span className="panel-eyebrow">Informe de campo</span>
        {selectedIsVariant ? (
          <span className="tag custom-tag">Jugada propia</span>
        ) : null}
        <h2>{selected.title}</h2>
        <div className="detail-grid">
          <div className="stat-box">
            <b>Fase</b>
            {selected.phase}
          </div>
          <div className="stat-box">
            <b>Principio</b>
            {selected.principle}
          </div>
          <div className="stat-box">
            <b>Jugadores</b>
            {selected.players.min}-{selected.players.max}
          </div>
          <div className="stat-box">
            <b>Duración</b>
            {selected.duration} min
          </div>
        </div>
        <p>
          <b>Objetivo:</b> {selected.objective.primary}
        </p>
        {selected.objective.secondary ? (
          <p>
            <b>Secundario:</b> {selected.objective.secondary}
          </p>
        ) : null}
        <p>
          <b>Organización:</b> {selected.organization}
        </p>
        <p>
          <b>Éxito:</b> {selected.success}
        </p>
        <h3>Coaching points</h3>
        <div>
          {selected.coaching.map((item) => (
            <span
              key={item}
              className="pill"
              style={{
                marginRight: 6,
                marginBottom: 6,
                display: "inline-block",
              }}
            >
              {item}
            </span>
          ))}
        </div>
        <h3 style={{ marginTop: 16 }}>Errores comunes</h3>
        <ul>
          {selected.errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="toolbar">
          <button
            type="button"
            onClick={() => useAppStore.getState().setView("viewer")}
          >
            Abrir visor
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => useAppStore.getState().addToSession(selected.id)}
          >
            Agregar a sesión
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleCreateEditableCopy}
          >
            Crear copia editable
          </button>
        </div>
        <details className="exercise-import-panel">
          <summary>Modo edicion / importar jugada</summary>
          <div className="library-action-row">
            <button
              type="button"
              className="secondary"
              onClick={handleUseSelectedAsTemplate}
            >
              Usar seleccion como plantilla
            </button>
            <button type="button" onClick={handleImportExercise}>
              Importar jugada
            </button>
          </div>
          <textarea
            value={importDraft}
            onChange={(event) => setImportDraft(event.target.value)}
            placeholder="Pegar Exercise JSON validado..."
            spellCheck={false}
          />
          {importFeedback ? (
            <p className={`import-feedback ${importFeedback.type}`}>
              {importFeedback.message}
            </p>
          ) : null}
        </details>
      </aside>
    </section>
  );
}
