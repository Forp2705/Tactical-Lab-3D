/* ===========================================================
   views1.jsx — Home / Dashboard  +  Visor táctico 3D
   =========================================================== */
const { useState: useS1, useEffect: useE1, useRef: useR1 } = React;

/* ---------- HOME ---------- */
function HomeView({ go }) {
  const dispo = PLAYERS.filter((p) => p.status === "available").length;
  return (
    <div className="view-enter grid" style={{ gap: 16 }}>
      <div className="hero">
        <span className="eyebrow">Matchday cockpit · MD-3</span>
        <h2>Construcción ante presión alta</h2>
        <p>Atlético Norte presiona 4-4-2 sobre los centrales. El plan de la semana ataca la salida con un 6 que baja y el lateral izquierdo por dentro.</p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => go("viewer")}>▶ Abrir visor táctico</button>
          <button className="btn ghost" onClick={() => go("ai")}>Consultar al asistente</button>
          <button className="btn ghost" onClick={() => go("team")}>Editar XI</button>
        </div>
      </div>

      <div className="stat-row">
        <Stat eyebrow="Próximo partido" big="vs Norte" sub="Jornada 19 · Local · 3 días" />
        <Stat eyebrow="Plantel" big={`${dispo}/14`} sub="disponibles · 1 duda · 1 lesión" />
        <Stat eyebrow="Carga semanal" big="92%" sub="pico en MD-3" accent />
        <Stat eyebrow="Reports" big="3" sub="post-partido en memoria" />
      </div>

      <div className="home-grid">
        <div className="grid" style={{ gap: 16 }}>
          <MicrocycleStrip go={go} />
          <div className="card">
            <div className="card-head">
              <div><span className="eyebrow">Sesión de hoy</span><h3>{SESSION.name}</h3></div>
              <button className="btn sm ghost" onClick={() => go("viewer")}>Ver bloques</button>
            </div>
            <div className="list">
              {SESSION.blocks.map((b, i) => (
                <div className="list-row" key={b.id}>
                  <div className="lr-icon">{String(i + 1).padStart(2, "0")}</div>
                  <div><b>{b.title}</b><small>{b.min} min · carga {loadLabel(b.load)}</small></div>
                  <span className={`chip ${b.load === "high" ? "" : ""}`}>{b.min}′</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><div><span className="eyebrow">Alertas del microciclo</span><h3>Lo que mirar hoy</h3></div></div>
            <div className="grid" style={{ gap: 10 }}>
              {MICRO_ALERTS.map((a, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, padding: "11px 12px", border: "1px solid var(--line)", borderLeft: `3px solid ${a.level === "warn" ? "var(--warn)" : "var(--accent-2)"}`, borderRadius: "var(--radius-sm)", background: "var(--panel-2)" }}>
                  <span className="mono" style={{ color: a.level === "warn" ? "var(--warn)" : "var(--accent-2)", fontSize: 11 }}>{a.level === "warn" ? "▲" : "ⓘ"}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div><span className="eyebrow">Post-partido</span><h3>Últimos reports</h3></div><button className="btn sm ghost" onClick={() => go("post")}>Abrir</button></div>
            <div className="list">
              {REPORT_HISTORY.map((r) => (
                <div className="list-row" key={r.id} style={{ cursor: "pointer" }} onClick={() => go("post")}>
                  <div className="lr-icon" style={{ color: r.result === "win" ? "var(--good)" : r.result === "loss" ? "var(--danger)" : "var(--warn)" }}>{r.score}</div>
                  <div><b>vs {r.rival}</b><small>{r.date} · {r.result === "win" ? "Victoria" : r.result === "loss" ? "Derrota" : "Empate"}</small></div>
                  <span className="tag-pill">guardado</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ eyebrow, big, sub, accent }) {
  return (
    <div className="stat-tile">
      <span className="eyebrow">{eyebrow}</span>
      <b style={accent ? { color: "var(--accent)" } : null}>{big}</b>
      <small>{sub}</small>
    </div>
  );
}

function MicrocycleStrip({ go }) {
  return (
    <div className="card">
      <div className="card-head"><div><span className="eyebrow">Microciclo semanal</span><h3>Distribución de carga</h3></div><button className="btn sm ghost" onClick={() => go("viewer")}>Planificar</button></div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${MICROCYCLE.length}, 1fr)`, gap: 8, alignItems: "end", height: 150 }}>
        {MICROCYCLE.map((d) => {
          const col = d.kind === "match" ? "var(--accent-2)" : d.kind === "high" ? "var(--accent)" : d.kind === "med" ? "var(--warn)" : "var(--muted-2)";
          return (
            <div key={d.day} style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 6, height: "100%" }}>
              <div style={{ display: "flex", alignItems: "end" }}>
                <div title={`${d.focus} · ${d.load}%`} style={{ width: "100%", height: `${d.load}%`, borderRadius: "7px 7px 4px 4px", background: d.active ? `linear-gradient(180deg,${col},color-mix(in oklch,${col} 40%,transparent))` : `color-mix(in oklch,${col} 30%,transparent)`, border: d.active ? `1px solid ${col}` : "1px solid var(--line)", minHeight: 8, transition: "height 300ms" }}></div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 10, color: d.active ? "var(--accent)" : "var(--muted)", fontWeight: 700 }}>{d.day}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function loadLabel(l) { return l === "high" ? "alta" : l === "med" ? "media" : "baja"; }

/* ---------- VISOR TÁCTICO ---------- */
function ViewerView() {
  const [exId, setExId] = useS1(EXERCISES[0].id);
  const exercise = EXERCISES.find((e) => e.id === exId);
  const dur = exercise.scene.duration;

  const [time, setTime] = useS1(0);
  const [playing, setPlaying] = useS1(true);
  const [speed, setSpeed] = useS1(1);
  const [camera, setCamera] = useS1(exercise.scene.camera || "broadcast");
  const [opts, setOpts] = useS1({ zones: true, overlays: true, rival: true });

  const raf = useR1(0); const last = useR1(0);
  useE1(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now) => {
      const dt = (now - last.current) / 1000; last.current = now;
      setTime((t) => { const n = t + dt * speed; return n >= dur ? 0 : n; });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, dur]);

  useE1(() => { setCamera(exercise.scene.camera || "broadcast"); setTime(0); }, [exId]);

  const phase = exercise.scene.phases.find((p) => time >= p.start && time <= p.end) || exercise.scene.phases[0];

  return (
    <div className="view-enter">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {EXERCISES.map((e) => (
          <button key={e.id} className={`chip ${e.id === exId ? "on" : ""}`} onClick={() => setExId(e.id)}>{e.title.split(" ").slice(0, 3).join(" ")}</button>
        ))}
      </div>
      <div className="viewer-grid">
        <div className="card" style={{ padding: 16 }}>
          <div className="card-head" style={{ marginBottom: 12 }}>
            <div><span className="eyebrow">{exercise.phaseLabel} · {exercise.principle}</span><h3>{exercise.title}</h3></div>
            <div className="segmented">
              {["top", "iso", "broadcast"].map((c) => (
                <button key={c} className={camera === c ? "active" : ""} onClick={() => setCamera(c)}>{c}</button>
              ))}
            </div>
          </div>

          <TacticalPitch exercise={exercise} time={time} camera={camera} showZones={opts.zones} showOverlays={opts.overlays} showRival={opts.rival} />

          {/* fases */}
          <div className="phase-track">
            {exercise.scene.phases.map((p) => (
              <i key={p.id} className={p.id === phase.id ? "on" : ""} style={{ flex: p.end - p.start }} title={p.name}></i>
            ))}
          </div>

          <div className="timeline">
            <div className="transport">
              <button className="icon-btn primary" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚" : "▶"}</button>
              <button className="icon-btn" onClick={() => setTime(0)} title="Reiniciar">↺</button>
            </div>
            <div className="scrub">
              <input type="range" min={0} max={dur} step={0.01} value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} />
            </div>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)", minWidth: 64, textAlign: "right" }}>{time.toFixed(1)} / {dur}s</span>
            <div className="segmented">
              {[0.5, 1, 2].map((s) => (<button key={s} className={speed === s ? "active" : ""} onClick={() => setSpeed(s)}>{s}x</button>))}
            </div>
          </div>
        </div>

        <aside className="grid" style={{ gap: 16 }}>
          <div className="card">
            <span className="eyebrow">Lectura del ejercicio</span>
            <p style={{ margin: "8px 0 0", lineHeight: 1.55, fontSize: 14 }}><b className="accent-text">Objetivo.</b> {exercise.objective.primary}</p>
            <p style={{ margin: "10px 0 0", lineHeight: 1.55, fontSize: 14, color: "var(--muted)" }}><b style={{ color: "var(--text)" }}>Éxito.</b> {exercise.success}</p>
            <hr className="divider" />
            <span className="eyebrow">Puntos de coaching</span>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.6, fontSize: 13.5 }}>
              {exercise.coaching.map((c, i) => <li key={i} style={{ marginBottom: 4 }}>{c}</li>)}
            </ul>
          </div>
          <div className="card">
            <span className="eyebrow">Capas visibles</span>
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              <Toggle label="Zonas" on={opts.zones} onClick={() => setOpts((o) => ({ ...o, zones: !o.zones }))} />
              <Toggle label="Pases · carreras · presión" on={opts.overlays} onClick={() => setOpts((o) => ({ ...o, overlays: !o.overlays }))} />
              <Toggle label="Equipo rival" on={opts.rival} onClick={() => setOpts((o) => ({ ...o, rival: !o.rival }))} />
            </div>
            <hr className="divider" />
            <div className="grid" style={{ gap: 8 }}>
              <button className="btn ghost">＋ Agregar a sesión</button>
              <button className="btn ghost">⎘ Duplicar como variante</button>
              <button className="btn ghost">⤓ Exportar MP4 / GIF</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle({ label, on, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "9px 11px", cursor: "pointer", textAlign: "left", color: "var(--text)" }}>
      <span style={{ width: 34, height: 20, borderRadius: 99, background: on ? "var(--accent)" : "rgba(255,255,255,0.12)", position: "relative", flex: "none", transition: "background 160ms" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 99, background: on ? "var(--on-accent)" : "var(--muted)", transition: "left 160ms" }}></span>
      </span>
      <span style={{ fontSize: 13 }}>{label}</span>
    </button>
  );
}

Object.assign(window, { HomeView, ViewerView, Toggle });
