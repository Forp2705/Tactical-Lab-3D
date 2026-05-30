/* ===========================================================
   views3.jsx — Video + tracking  +  Análisis post-partido
   =========================================================== */
const { useState: useS3, useEffect: useE3, useRef: useR3 } = React;

/* ---------- VIDEO + TRACKING ---------- */
function VideoView() {
  const DURV = 135;
  const [t, setT] = useS3(48);
  const [playing, setPlaying] = useS3(false);
  const [tags, setTags] = useS3(VIDEO_TAGS);
  const [track, setTrack] = useS3(TRACK_PATH);
  const raf = useR3(0); const last = useR3(0);

  useE3(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now) => {
      const dt = (now - last.current) / 1000; last.current = now;
      setT((v) => (v + dt >= DURV ? 0 : v + dt));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  function addTag(b) {
    setTags((prev) => [...prev, { id: "vt" + Date.now(), t: Math.round(t), label: b.label, color: b.color, cat: "custom" }].sort((a, z) => a.t - z.t));
  }
  function fmt(s) { const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, "0")}`; }
  function addTrackPoint(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setTrack((p) => [...p, { x, y }]);
  }

  return (
    <div className="view-enter two-col">
      <div className="card" style={{ padding: 16 }}>
        <div className="card-head" style={{ marginBottom: 12 }}><div><span className="eyebrow">Análisis de video · tagging manual</span><h3>vs Atlético Norte · 1T</h3></div><span className="chip">{tags.length} tags</span></div>

        <div className="video-frame">
          <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%", display: "block" }}>
            <defs>
              <pattern id="vstripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="14" height="14" fill="#0a141b" /><rect width="7" height="14" fill="#0c1820" />
              </pattern>
            </defs>
            <rect width="320" height="180" fill="url(#vstripe)" />
            <text x="160" y="86" textAnchor="middle" fill="var(--muted-2)" fontSize="11" style={{ fontFamily: "var(--font-mono)" }}>CLIP DE PARTIDO</text>
            <text x="160" y="102" textAnchor="middle" fill="var(--muted-2)" fontSize="8" style={{ fontFamily: "var(--font-mono)" }}>arrastrá un .mp4 aquí</text>
          </svg>
          <div style={{ position: "absolute", left: 12, top: 12 }} className="chip">{fmt(t)} / {fmt(DURV)}</div>
          <div className="tag-rail"></div>
        </div>

        {/* timeline con tags */}
        <div className="tag-track" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setT(((e.clientX - r.left) / r.width) * DURV); setPlaying(false); }} style={{ cursor: "pointer" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(t / DURV) * 100}%`, background: "color-mix(in oklch,var(--accent) 40%,transparent)", borderRadius: 99 }}></div>
          <div style={{ position: "absolute", left: `${(t / DURV) * 100}%`, top: -4, bottom: -4, width: 2, background: "var(--accent)" }}></div>
          {tags.map((tag) => (
            <div key={tag.id} className="tag-mark" style={{ left: `${(tag.t / DURV) * 100}%`, background: tag.color }} title={`${tag.label} · ${fmt(tag.t)}`}></div>
          ))}
        </div>

        <div className="timeline" style={{ marginTop: 16 }}>
          <div className="transport">
            <button className="icon-btn primary" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚" : "▶"}</button>
          </div>
          <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(t)}</span>
          <div style={{ flex: 1 }}></div>
          <button className="btn sm ghost" onClick={() => { const csv = "t,label\n" + tags.map((x) => `${x.t},${x.label}`).join("\n"); navigator.clipboard?.writeText(csv); }}>⤓ Export CSV</button>
        </div>

        <hr className="divider" />
        <span className="eyebrow">Etiquetar en el minuto actual</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {VIDEO_TAG_BUTTONS.map((b) => (
            <button key={b.label} className="chip" style={{ cursor: "pointer", borderColor: b.color, color: b.color }} onClick={() => addTag(b)}>＋ {b.label}</button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="card-head" style={{ marginBottom: 10 }}><div><span className="eyebrow">Tracking manual · click para marcar</span><h3>Conducción nº 8</h3></div><button className="btn sm ghost" onClick={() => setTrack([])}>Limpiar</button></div>
          <div className="pitch-wrap" style={{ aspectRatio: "100 / 64", cursor: "crosshair" }} onClick={addTrackPoint}>
            <svg viewBox="0 0 100 64" style={{ pointerEvents: "none" }}>
              <g stroke="rgba(255,255,255,0.4)" strokeWidth="0.35" fill="none">
                <rect x="2" y="2" width="96" height="60" rx="1.2" /><line x1="50" y1="2" x2="50" y2="62" /><circle cx="50" cy="32" r="8" />
              </g>
              {track.length > 1 && <polyline className="track-path" stroke="var(--accent)" points={track.map((p) => `${(p.x / 100) * 100},${(p.y / 100) * 64}`).join(" ")} />}
            </svg>
            {track.map((p, i) => (
              <div key={i} className="track-dot" style={{ left: `${p.x}%`, top: `${p.y}%`, background: i === track.length - 1 ? "var(--accent)" : "rgba(94,234,212,0.5)" }}></div>
            ))}
          </div>
          <div className="tracking-status" style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--panel-2)" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>PUNTOS</span><b>{track.length}</b>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>DISTANCIA ≈</span><b>{trackDist(track)} m</b>
            <span className="chip on" style={{ marginLeft: "auto" }}>nº 8</span>
          </div>
        </div>
        <div className="card">
          <div className="card-head" style={{ marginBottom: 10 }}><div><span className="eyebrow">Marcadores</span><h3>{tags.length} eventos</h3></div></div>
          <div className="grid" style={{ gap: 7, maxHeight: 220, overflow: "auto" }}>
            {tags.map((tag) => (
              <div key={tag.id} className="list-row" onClick={() => { setT(tag.t); setPlaying(false); }} style={{ cursor: "pointer", gridTemplateColumns: "auto 1fr auto" }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: tag.color }}></span>
                <b style={{ fontSize: 13 }}>{tag.label}</b>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{fmt(tag.t)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function trackDist(t) {
  let d = 0;
  for (let i = 1; i < t.length; i++) { d += Math.hypot((t[i].x - t[i - 1].x) * 1.05, (t[i].y - t[i - 1].y) * 0.68); }
  return Math.round(d);
}

/* ---------- POST-PARTIDO ---------- */
const PM_STEPS = ["Cargar contexto", "Generar reporte", "Revisar", "Guardar", "Commit a memoria"];
function PostMatchView({ go }) {
  const pm = POST_MATCH;
  const [step] = useS3(2);
  const [sel, setSel] = useS3(new Set(["mc1", "mc2"]));
  const [committed, setCommitted] = useS3(false);

  function toggle(id) { setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); setCommitted(false); return n; }); }

  return (
    <div className="view-enter grid" style={{ gap: 16 }}>
      {/* stepper */}
      <div className="card" style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {PM_STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 99, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: i <= step ? "var(--on-accent)" : "var(--muted-2)", background: i <= step ? "var(--accent)" : "var(--panel-2)", border: "1px solid var(--line)" }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: i === step ? "var(--text)" : "var(--muted)", fontWeight: i === step ? 600 : 400 }}>{s}</span>
              </div>
              {i < PM_STEPS.length - 1 && <span style={{ flex: 1, minWidth: 14, height: 1, background: "var(--line)" }}></span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="report-grid">
        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <div><span className="eyebrow">{pm.date} · {pm.venue}</span><h3>vs {pm.rival}</h3></div>
              <span className="chip">{pm.formationUs} vs {pm.formationThem}</span>
            </div>
            <div className="score-board">
              <div className="score" style={{ color: pm.scoreUs > pm.scoreThem ? "var(--good)" : "var(--text)" }}>{pm.scoreUs}–{pm.scoreThem}</div>
              <div style={{ flex: 1 }}>
                <span className="chip" style={{ color: "var(--good)" }}>Victoria</span>
                <p className="mono" style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0" }}>{pm.control} · apreciación del CT</p>
              </div>
            </div>
            <p style={{ marginTop: 14, marginBottom: 0, lineHeight: 1.6, fontSize: 14, color: "var(--muted)" }}>{pm.summary}</p>
          </div>

          <div className="two-col">
            <div className="card">
              <span className="eyebrow accent-text" style={{ color: "var(--good)" }}>▲ Fortalezas</span>
              <ul style={{ margin: "10px 0 0", paddingLeft: 16, lineHeight: 1.6, fontSize: 13.5 }}>
                {pm.strengths.map((s, i) => <li key={i} style={{ marginBottom: 10 }}>{s}</li>)}
              </ul>
            </div>
            <div className="card">
              <span className="eyebrow" style={{ color: "var(--danger)" }}>▼ A corregir</span>
              <ul style={{ margin: "10px 0 0", paddingLeft: 16, lineHeight: 1.6, fontSize: 13.5 }}>
                {pm.issues.map((s, i) => <li key={i} style={{ marginBottom: 10 }}>{s}</li>)}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ marginBottom: 4 }}>
              <div><span className="eyebrow accent-text">Propuestas para mejorar</span><h3>Qué llevar al entrenamiento</h3></div>
            </div>
            <div className="grid" style={{ gap: 10, marginTop: 8 }}>
              {pm.proposals.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 12, padding: "14px 14px", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--radius-sm)", background: "var(--panel-2)" }}>
                  <span className="mono accent-text" style={{ fontWeight: 700, fontSize: 14 }}>{i + 1}</span>
                  <div>
                    <b style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{p.title}</b>
                    <p style={{ margin: "6px 0 10px", fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)" }}>{p.detail}</p>
                    <button className="btn sm ghost" onClick={() => go && go(p.to)}>{p.action} →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ marginBottom: 6 }}>
              <div><span className="eyebrow">Candidatos a memoria táctica</span><h3>El staff decide qué se aprende</h3></div>
            </div>
            <p className="mono" style={{ fontSize: 11, color: "var(--muted-2)", margin: "0 0 14px" }}>La memoria no se escribe automáticamente. Seleccioná los principios a commitear.</p>
            <div className="grid" style={{ gap: 10 }}>
              {pm.memoryCandidates.map((c) => {
                const on = sel.has(c.id);
                return (
                  <div key={c.id} className={`memory-cand ${on ? "sel" : ""}`} onClick={() => toggle(c.id)} style={{ cursor: "pointer" }}>
                    <span className="checkbox">✓</span>
                    <div>
                      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{c.text}</span>
                      <div style={{ marginTop: 6 }}><span className="tag-pill">confianza {c.confidence}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <hr className="divider" />
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className={`btn ${committed ? "ghost" : "primary"}`} onClick={() => setCommitted(true)} disabled={sel.size === 0}>
                {committed ? `✓ ${sel.size} principios en memoria` : `Commit ${sel.size} a memoria táctica`}
              </button>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted-2)" }}>· también exportable a PDF</span>
            </div>
          </div>
        </div>

        <aside className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head" style={{ marginBottom: 10 }}><div><span className="eyebrow">Historial</span><h3>Reports guardados</h3></div></div>
            <div className="grid" style={{ gap: 7 }}>
              {REPORT_HISTORY.map((r, i) => (
                <div key={r.id} className="list-row" style={{ borderColor: i === 0 ? "var(--accent)" : "var(--line)" }}>
                  <div className="lr-icon" style={{ color: r.result === "win" ? "var(--good)" : r.result === "loss" ? "var(--danger)" : "var(--warn)" }}>{r.score}</div>
                  <div><b style={{ fontSize: 13 }}>vs {r.rival}</b><small>{r.date}</small></div>
                  {i === 0 && <span className="chip on">actual</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <span className="eyebrow">Exportar</span>
            <div className="grid" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn ghost">⤓ PDF del reporte</button>
              <button className="btn ghost">↗ Enviar al asistente</button>
            </div>
          </div>
          <div className="card" style={{ background: "linear-gradient(180deg, color-mix(in oklch,var(--accent) 8%,var(--panel)), var(--panel-2))" }}>
            <span className="eyebrow">Grounding</span>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)", margin: "10px 0 0" }}>El reporte se arma solo con lo que vos cargás: el plan previo, tus tags de video, el tracking manual y tus notas. Nada de xG ni métricas que no puedas medir vos.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { VideoView, PostMatchView });
