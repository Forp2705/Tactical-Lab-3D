/* ===========================================================
   views2.jsx — Equipo / Lineup Lab  +  Asistente táctico IA
   =========================================================== */
const { useState: useS2, useMemo: useM2, useRef: useR2, useEffect: useE2 } = React;

/* ---------- EQUIPO / LINEUP LAB ---------- */
function TeamView() {
  const [shape, setShape] = useS2("4-3-3");
  const [lineup, setLineup] = useS2(() => SHAPES["4-3-3"].map((s) => ({ ...s })));
  const [selIdx, setSelIdx] = useS2(4);
  const [showRival, setShowRival] = useS2(true);
  const [published, setPublished] = useS2(false);

  const playersById = useM2(() => Object.fromEntries(PLAYERS.map((p) => [p.id, p])), []);
  const selPlayer = selIdx != null ? playersById[lineup[selIdx]?.playerId] : null;

  function changeShape(s) {
    setShape(s);
    setLineup(SHAPES[s].map((sl) => ({ ...sl })));
    setPublished(false);
  }
  function moveSlot(i, c) {
    setLineup((prev) => prev.map((sl, idx) => (idx === i ? { ...sl, x: c.x, y: c.y } : sl)));
    setPublished(false);
  }
  const onPitch = new Set(lineup.map((s) => s.playerId));
  const bench = PLAYERS.filter((p) => !onPitch.has(p.id));

  return (
    <div className="view-enter">
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div className="segmented">
          {Object.keys(SHAPES).map((s) => (<button key={s} className={shape === s ? "active" : ""} onClick={() => changeShape(s)}>{s}</button>))}
        </div>
        <Toggle label="Overlay rival" on={showRival} onClick={() => setShowRival((v) => !v)} />
        <div style={{ flex: 1 }}></div>
        <button className={`btn ${published ? "ghost" : "primary"}`} onClick={() => setPublished(true)}>
          {published ? "✓ Shape publicado al asistente" : "↗ Publicar shape al asistente"}
        </button>
      </div>

      <div className="team-grid">
        <div className="card" style={{ padding: 16 }}>
          <div className="card-head" style={{ marginBottom: 12 }}>
            <div><span className="eyebrow">Lineup Lab · arrastrá los jugadores</span><h3>{shape} · salida asimétrica</h3></div>
            <span className="chip">{lineup.length} en cancha</span>
          </div>
          <LineupPitch lineup={lineup} onMove={moveSlot} selectedIdx={selIdx} onSelect={setSelIdx} showRival={showRival} compact />
          <p className="mono" style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10, textAlign: "center" }}>
            El snapshot del shape se inyecta como contexto al asistente táctico
          </p>
        </div>

        <aside className="grid" style={{ gap: 16 }}>
          {selPlayer && (
            <div className="card">
              <div className="card-head" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className={`num ${selPlayer.pos[0] === "GK" ? "gk" : ""}`} style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 18, color: "var(--on-accent)", background: selPlayer.pos[0] === "GK" ? "linear-gradient(135deg,var(--warn),#e89b3c)" : "linear-gradient(135deg,var(--accent),var(--accent-2))" }}>{selPlayer.num}</div>
                  <div>
                    <h3 style={{ margin: 0 }}>{selPlayer.name}</h3>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{selPlayer.pos.join(" · ")} · pie {selPlayer.foot}</span>
                  </div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}><span className={`status-dot ${selPlayer.status}`}></span><span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>{STATUS_LABEL[selPlayer.status]}</span></span>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>{selPlayer.profile}</p>
              <div className="grid" style={{ gap: 7 }}>
                {Object.entries({ vel: "Velocidad", res: "Resistencia", pas: "Pase", ctl: "Control", pre: "Presión", due: "Duelo", tac: "Táctico" }).map(([k, label]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "84px 1fr 28px", gap: 8, alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 10, color: "var(--muted-2)", textTransform: "uppercase" }}>{label}</span>
                    <div className="bar"><i style={{ width: `${selPlayer.attr[k]}%` }}></i></div>
                    <span className="mono" style={{ fontSize: 11, textAlign: "right" }}>{selPlayer.attr[k]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 10 }}><div><span className="eyebrow">Plantel</span><h3>Banco y alternativas</h3></div></div>
            <div className="grid" style={{ gap: 7, maxHeight: 280, overflow: "auto" }}>
              {bench.map((p) => (
                <div key={p.id} className="player-row" style={{ cursor: "default" }}>
                  <div className={`num ${p.pos[0] === "GK" ? "gk" : ""}`}>{p.num}</div>
                  <div><b style={{ fontSize: 13 }}>{p.name}</b><small className="mono" style={{ display: "block", color: "var(--muted)", marginTop: 2 }}>{p.pos.join(" · ")}</small></div>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`status-dot ${p.status}`} title={STATUS_LABEL[p.status]}></span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>{STATUS_LABEL[p.status].slice(0, 4)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- ASISTENTE TÁCTICO IA ---------- */
function AiView() {
  const [thread, setThread] = useS2(AI_THREAD);
  const [input, setInput] = useS2("");
  const [typing, setTyping] = useS2(false);
  const scrollRef = useR2(null);

  useE2(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [thread, typing]);

  function send(text) {
    const q = (text ?? input).trim();
    if (!q || typing) return;
    setThread((t) => [...t, { role: "Cuerpo técnico", who: "user", text: q }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setThread((t) => [...t, {
        role: "Asistente táctico", who: "coach",
        lectura: "Buena pregunta. Cruzando el shape publicado con la memoria del equipo y los 3 reports recientes, la lectura es la siguiente:",
        advice: [
          "Mantené el principio de progresar por dentro: con superioridad central no fuerces el carril exterior temprano.",
          "Si el rival ajusta y tapa al 6, rotá: que el interior caiga a recibir y el 6 ofrezca por delante (intercambio de alturas).",
          "Vigilá el seguro de reacción tras pérdida — es tu punto débil recurrente en los reports.",
        ],
        riesgo: "Validado contra 14 principios estables. No contradice memoria previa; refuerza el patrón del último partido.",
      }]);
    }, 1500);
  }

  const SUGG = ["¿Y si nos presionan al 6?", "Plan B si vamos perdiendo", "Cómo defender sus ABP"];

  return (
    <div className="view-enter ai-grid">
      <aside className="grid" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-head" style={{ marginBottom: 6 }}><div><span className="eyebrow">Contexto inyectado</span><h3>El asistente ve</h3></div></div>
          <div style={{ marginTop: 4 }}>
            {AI_CONTEXT.map((c) => (
              <div className="ctx-row" key={c.k}><span className="ctx-k">{c.k}</span><span className="ctx-v">{c.v}</span></div>
            ))}
          </div>
        </div>
        <div className="card">
          <span className="eyebrow">Memoria estable</span>
          <ul style={{ margin: "10px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
            {STABLE_MEMORY.map((m, i) => <li key={i} style={{ marginBottom: 8 }}>{m}</li>)}
          </ul>
          <p className="mono" style={{ fontSize: 10, color: "var(--muted-2)", marginTop: 12, marginBottom: 0 }}>La memoria no se actualiza automáticamente — solo desde post-partido.</p>
        </div>
      </aside>

      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 620, padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="live-pill"><i></i>Asistente en línea</span>
          </div>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>salida validada con Zod</span>
        </div>

        <div ref={scrollRef} className="ai-stream" style={{ flex: 1, overflow: "auto", padding: 18 }}>
          {thread.map((m, i) => (
            <div className="ai-msg" key={i}>
              <span className="role">{m.who === "user" ? "▸ " : "◆ "}{m.role}</span>
              {m.who === "user" ? (
                <div className="ai-bubble" style={{ maxWidth: "82%" }}>{m.text}</div>
              ) : (
                <div className="ai-bubble coach">
                  <p style={{ margin: 0, lineHeight: 1.55 }}>{m.lectura}</p>
                  <div className="advice-block" style={{ marginTop: 14 }}>
                    {m.advice.map((a, j) => (
                      <div className="advice-item" key={j}><span className="idx">{j + 1}</span><span style={{ lineHeight: 1.5, fontSize: 14 }}>{a}</span></div>
                    ))}
                  </div>
                  {m.riesgo && (
                    <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "rgba(0,0,0,0.22)", borderLeft: "3px solid var(--warn)", fontSize: 12.5, color: "var(--muted)" }}>
                      <b className="mono" style={{ color: "var(--warn)", fontSize: 10, letterSpacing: "0.1em" }}>RIESGO / VALIDACIÓN</b><br />{m.riesgo}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className="ai-msg"><span className="role">◆ Asistente táctico</span><div className="ai-bubble coach typing"><i></i><i></i><i></i></div></div>
          )}
        </div>

        <div style={{ padding: 14, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {SUGG.map((s) => <button key={s} className="chip" style={{ cursor: "pointer" }} onClick={() => send(s)}>{s}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="Preguntá algo táctico…" value={input} style={{ flex: 1 }}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            <button className="btn primary" onClick={() => send()} disabled={typing}>Enviar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TeamView, AiView });
