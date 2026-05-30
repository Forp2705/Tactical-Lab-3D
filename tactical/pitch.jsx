/* ===========================================================
   pitch.jsx — visor táctico animado + pitch de lineup (drag)
   =========================================================== */
const { useState: useStateP, useRef: useRefP, useEffect: useEffectP, useMemo: useMemoP } = React;

/* mapeo de coords de cancha 0..100 -> viewBox */
const PW = 100, PH = 64;
const sx = (x) => (x / 100) * PW;
const sy = (y) => (y / 100) * PH;

function smooth(p) { return p * p * (3 - 2 * p); }

/* posición interpolada de un actor en tiempo t */
function actorPos(actor, t) {
  const kf = [{ t: 0, pos: actor.start }, ...(actor.path || [])];
  if (t <= kf[0].t) return kf[0].pos;
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].pos;
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = smooth((t - a.t) / (b.t - a.t || 1));
      return { x: a.pos.x + (b.pos.x - a.pos.x) * p, y: a.pos.y + (b.pos.y - a.pos.y) * p };
    }
  }
  return kf[kf.length - 1].pos;
}
function ballPos(ball, t) {
  const kf = [{ t: 0, pos: ball.start }, ...(ball.path || [])];
  if (t <= 0) return kf[0].pos;
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].pos;
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = (t - a.t) / (b.t - a.t || 1);
      return { x: a.pos.x + (b.pos.x - a.pos.x) * p, y: a.pos.y + (b.pos.y - a.pos.y) * p };
    }
  }
  return kf[kf.length - 1].pos;
}

function PitchMarkings({ color = "rgba(255,255,255,0.55)" }) {
  const sw = 0.35;
  return (
    <g stroke={color} strokeWidth={sw} fill="none">
      <rect x={2} y={2} width={PW - 4} height={PH - 4} rx={1.2} />
      <line x1={PW / 2} y1={2} x2={PW / 2} y2={PH - 2} />
      <circle cx={PW / 2} cy={PH / 2} r={8} />
      <circle cx={PW / 2} cy={PH / 2} r={0.7} fill={color} stroke="none" />
      {/* áreas */}
      <rect x={2} y={PH / 2 - 13} width={11} height={26} />
      <rect x={2} y={PH / 2 - 6} width={4.5} height={12} />
      <rect x={PW - 13} y={PH / 2 - 13} width={11} height={26} />
      <rect x={PW - 6.5} y={PH / 2 - 6} width={4.5} height={12} />
      <path d={`M 13 ${PH/2 - 5} A 6 6 0 0 1 13 ${PH/2 + 5}`} />
      <path d={`M ${PW-13} ${PH/2 - 5} A 6 6 0 0 0 ${PW-13} ${PH/2 + 5}`} />
    </g>
  );
}

/* ===========================================================
   VISOR TÁCTICO ANIMADO
   =========================================================== */
function TacticalPitch({ exercise, time, showZones = true, showOverlays = true, showRival = true, camera = "broadcast" }) {
  const scene = exercise.scene;
  const phase = useMemoP(() => scene.phases.find((p) => time >= p.start && time <= p.end) || scene.phases[0], [scene, time]);

  const camTransform = {
    top: "none",
    iso: "perspective(900px) rotateX(34deg) scale(1.02)",
    broadcast: "perspective(1200px) rotateX(20deg)",
  }[camera] || "none";

  const actors = scene.actors.filter((a) => showRival || a.team !== "rival");

  return (
    <div className="pitch-wrap" style={{ aspectRatio: "100 / 64" }}>
      <div className="phase-badge">
        <span style={{ width: 7, height: 7, borderRadius: 9, background: "var(--warn)", display: "inline-block" }}></span>
        {phase.name} · {time.toFixed(1)}s
      </div>
      <div className="cam-badge">CAM · {camera}</div>
      <div style={{ transformStyle: "preserve-3d", transform: camTransform, transition: "transform 420ms ease", transformOrigin: "center 58%" }}>
        <svg viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label={exercise.title}>
          {/* césped rayado */}
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={(i * PW) / 10} y={0} width={PW / 10} height={PH}
              fill={i % 2 ? "rgba(255,255,255,0.025)" : "transparent"} />
          ))}
          <PitchMarkings />

          {/* zonas */}
          {showZones && scene.zones?.filter((z) => z.phases.includes(phase.id)).map((z, i) => (
            <g key={i}>
              <rect x={sx(z.x)} y={sy(z.y)} width={sx(z.w)} height={sy(z.h)} rx={1.2}
                fill="color-mix(in oklch, var(--accent) 14%, transparent)"
                stroke="var(--accent)" strokeWidth={0.3} strokeDasharray="1.4 1" opacity={0.85} />
              <text x={sx(z.x) + 1.4} y={sy(z.y) + 3} fontSize={2.3} fill="var(--accent)"
                style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1px" }}>{z.label}</text>
            </g>
          ))}

          {/* overlays (pases/carreras/presión) durante su ventana */}
          {showOverlays && scene.overlays?.map((ov, i) => {
            const active = time >= ov.start && time <= (ov.end + 0.4);
            if (!active) return null;
            const p = Math.min(1, (time - ov.start) / ((ov.end - ov.start) || 1));
            const fx = sx(ov.from.x), fy = sy(ov.from.y), tx = sx(ov.to.x), ty = sy(ov.to.y);
            const cx = fx + (tx - fx) * p, cy = fy + (ty - fy) * p;
            const stroke = ov.type === "press" ? "var(--danger)" : ov.type === "run" ? "var(--warn)" : "var(--accent)";
            const dash = ov.type === "run" ? "1.6 1.2" : ov.type === "press" ? "0.8 0.8" : "none";
            return (
              <g key={i} opacity={0.95}>
                <defs>
                  <marker id={`arw-${i}`} markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
                    <path d="M0,0 L5,2.5 L0,5 z" fill={stroke} />
                  </marker>
                </defs>
                <line x1={fx} y1={fy} x2={cx} y2={cy} stroke={stroke} strokeWidth={0.55}
                  strokeDasharray={dash} markerEnd={p > 0.9 ? `url(#arw-${i})` : undefined} strokeLinecap="round" />
                {ov.label && p > 0.5 && (
                  <text x={(fx + tx) / 2} y={(fy + ty) / 2 - 1.2} fontSize={2.1} fill={stroke}
                    textAnchor="middle" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{ov.label}</text>
                )}
              </g>
            );
          })}

          {/* actores */}
          {actors.map((a) => {
            const pos = actorPos(a, time);
            const isRival = a.team === "rival";
            const fill = isRival ? "rgba(255,116,116,0.92)" : "color-mix(in oklch, var(--accent) 88%, white)";
            const stroke = isRival ? "#ff7474" : "var(--accent)";
            return (
              <g key={a.id} transform={`translate(${sx(pos.x)}, ${sy(pos.y)})`} style={{ transition: "none" }}>
                <circle r={2.7} fill={isRival ? "rgba(120,20,20,0.65)" : "rgba(4,16,18,0.6)"} opacity={0.5} cy={0.6} />
                <circle r={2.3} fill={fill} stroke={stroke} strokeWidth={0.4} />
                <text y={0.9} fontSize={2.6} textAnchor="middle" fill={isRival ? "#fff" : "var(--on-accent)"}
                  style={{ fontFamily: "var(--font-head)", fontWeight: 800 }}>{a.num}</text>
                <text y={-3.1} fontSize={1.7} textAnchor="middle" fill={isRival ? "rgba(255,200,200,0.8)" : "rgba(255,255,255,0.7)"}
                  style={{ fontFamily: "var(--font-mono)" }}>{a.role}</text>
              </g>
            );
          })}

          {/* pelota */}
          {(() => {
            const b = ballPos(scene.ball, time);
            return (
              <g transform={`translate(${sx(b.x)}, ${sy(b.y)})`}>
                <circle r={1.7} fill="rgba(0,0,0,0.4)" cy={0.5} opacity={0.5} />
                <circle r={1.25} fill="#fff" stroke="#0a0a0a" strokeWidth={0.25} />
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

/* ===========================================================
   PITCH DE LINEUP (drag)
   =========================================================== */
function LineupPitch({ lineup, onMove, selectedIdx, onSelect, showRival = false, compact = false }) {
  const ref = useRefP(null);
  const dragIdx = useRefP(null);
  const playersById = useMemoP(() => Object.fromEntries(PLAYERS.map((p) => [p.id, p])), []);

  function pointerToCoord(e) {
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    return { x: Math.max(4, Math.min(96, x)), y: Math.max(5, Math.min(95, y)) };
  }
  function onDown(i, e) {
    e.preventDefault();
    dragIdx.current = i;
    onSelect && onSelect(i);
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
  }
  function onMoveEv(e) {
    if (dragIdx.current == null) return;
    const c = pointerToCoord(e);
    onMove && onMove(dragIdx.current, c);
  }
  function onUp() {
    dragIdx.current = null;
    window.removeEventListener("pointermove", onMoveEv);
    window.removeEventListener("pointerup", onUp);
  }

  return (
    <div className="pitch-wrap" ref={ref} style={{ aspectRatio: compact ? "100 / 72" : "100 / 64", touchAction: "none", cursor: "default" }}>
      <svg viewBox={`0 0 ${PW} ${PH}`} style={{ pointerEvents: "none" }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={(i * PW) / 10} y={0} width={PW / 10} height={PH} fill={i % 2 ? "rgba(255,255,255,0.025)" : "transparent"} />
        ))}
        <PitchMarkings />
        {showRival && [
          { x: 70, y: 50 }, { x: 80, y: 30 }, { x: 80, y: 70 }, { x: 88, y: 50 },
        ].map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2} fill="rgba(255,116,116,0.4)" stroke="rgba(255,116,116,0.7)" strokeWidth={0.3} />
        ))}
      </svg>
      {lineup.map((slot, i) => {
        const pl = playersById[slot.playerId];
        const sel = selectedIdx === i;
        const gk = slot.slot === "GK";
        return (
          <div key={i}
            onPointerDown={(e) => onDown(i, e)}
            style={{
              position: "absolute", left: `${slot.x}%`, top: `${slot.y}%`,
              transform: "translate(-50%,-50%)", cursor: "grab",
              display: "grid", placeItems: "center", textAlign: "center",
              zIndex: sel ? 10 : 2, userSelect: "none",
            }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center",
              fontFamily: "var(--font-head)", fontWeight: 800, fontSize: 15,
              color: "var(--on-accent)",
              background: gk ? "linear-gradient(135deg,var(--warn),#e89b3c)" : "linear-gradient(135deg,var(--accent),var(--accent-2))",
              border: sel ? "2px solid #fff" : "2px solid transparent",
              boxShadow: sel ? "0 0 0 3px color-mix(in oklch,var(--accent) 40%,transparent)" : "0 6px 16px rgba(0,0,0,0.4)",
            }}>{pl?.num}</div>
            <div style={{ fontSize: 9, marginTop: 3, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
              {pl?.name.split(" ").slice(-1)[0]}
            </div>
            <div style={{ position: "absolute", top: -13, fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--accent)", letterSpacing: "0.5px" }}>{slot.slot}</div>
          </div>
        );
      })}
    </div>
  );
}

/* mini cancha estática para tarjetas (preview de ejercicio) */
function PitchThumb({ exercise }) {
  const t = exercise.scene.duration * 0.55;
  return (
    <div className="pitch-wrap" style={{ aspectRatio: "16 / 9" }}>
      <svg viewBox={`0 0 ${PW} ${PH}`}>
        <PitchMarkings color="rgba(255,255,255,0.4)" />
        {exercise.scene.actors.map((a) => {
          const pos = actorPos(a, t);
          const isRival = a.team === "rival";
          return (
            <circle key={a.id} cx={sx(pos.x)} cy={sy(pos.y)} r={1.9}
              fill={isRival ? "rgba(255,116,116,0.9)" : "var(--accent)"} stroke={isRival ? "#ff7474" : "var(--accent)"} strokeWidth={0.3} />
          );
        })}
        {(() => { const b = ballPos(exercise.scene.ball, t); return <circle cx={sx(b.x)} cy={sy(b.y)} r={1.1} fill="#fff" />; })()}
      </svg>
    </div>
  );
}

Object.assign(window, { TacticalPitch, LineupPitch, PitchThumb, actorPos, ballPos });
