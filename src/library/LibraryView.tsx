import { catalog } from "@/data";
import { getExerciseById, useAppStore } from "@/state/useAppStore";

export function LibraryView() {
  const search = useAppStore((state) => state.search);
  const phase = useAppStore((state) => state.phase);
  const level = useAppStore((state) => state.level);
  const principle = useAppStore((state) => state.principle);
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const selectExercise = useAppStore((state) => state.selectExercise);
  const exercises = [...catalog, ...exerciseVariants];

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
              <canvas
                width={320}
                height={180}
                ref={(canvas) => {
                  if (!canvas) return;
                  const context = canvas.getContext("2d");
                  if (!context) return;
                  context.clearRect(0, 0, canvas.width, canvas.height);
                  const gradient = context.createLinearGradient(0, 0, 320, 180);
                  gradient.addColorStop(0, "#0c2a31");
                  gradient.addColorStop(1, "#122f1c");
                  context.fillStyle = gradient;
                  context.fillRect(0, 0, 320, 180);
                  context.fillStyle = "rgba(255,255,255,0.86)";
                  context.fillRect(24, 36, 272, 108);
                  context.fillStyle = "#0e3823";
                  context.fillRect(27, 39, 266, 102);
                  context.strokeStyle = "#e6f5ef";
                  context.lineWidth = 2;
                  context.strokeRect(27, 39, 266, 102);
                  context.fillStyle = "#e6f5ef";
                  context.fillRect(156, 39, 2, 102);
                  context.beginPath();
                  context.arc(160, 90, 24, 0, Math.PI * 2);
                  context.stroke();
                  context.fillStyle = "#5eead4";
                  context.fillRect(55, 77, 16, 16);
                  context.fillRect(240, 88, 16, 16);
                }}
              />
              <div className="card-meta">
                <h3>{exercise.title}</h3>
                <span>{exercise.duration} min</span>
              </div>
              <div className="tags">
                <span className="tag">{exercise.phase}</span>
                <span className="tag">{exercise.principle}</span>
                <span className="tag">{exercise.level}</span>
                <span className="tag">
                  {exercise.players.min}-{exercise.players.max} jugadores
                </span>
              </div>
              <div className="card-load-row">
                <span>RPE {exercise.rpe}</span>
                <i style={{ width: `${exercise.rpe * 10}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>
      <aside className="detail-panel">
        <span className="panel-eyebrow">Informe de campo</span>
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
        </div>
      </aside>
    </section>
  );
}
