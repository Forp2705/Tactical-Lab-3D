/* ===========================================================
   app.jsx — shell + navegación + routing + Tweaks
   =========================================================== */
const { useState: useSA, useEffect: useEA } = React;

const NAV = [
  { id: "home", code: "HOME", label: "Inicio" },
  { id: "viewer", code: "3D", label: "Visor táctico" },
  { id: "team", code: "XI", label: "Equipo · Lineup" },
  { id: "ai", code: "AI", label: "Asistente táctico" },
  { id: "video", code: "VID", label: "Video + tracking" },
  { id: "post", code: "PM", label: "Post-partido" },
];
const META = {
  home: ["Matchday cockpit", "Centro de mando del cuerpo técnico", "Lo importante de la semana en un vistazo."],
  viewer: ["Field ready", "Visor táctico 3D integrado", "Reproducción de escenas con cámaras, capas y fases."],
  team: ["Sistema de equipo", "Equipo · Lineup Lab", "Plantel, shapes y snapshot contextual para el asistente."],
  ai: ["Asistente local", "Asistente táctico", "Consulta con contexto del equipo, memoria y reports — salida estructurada."],
  video: ["Análisis", "Video + tracking asistido", "Tagging manual, marcadores y tracking por click."],
  post: ["Memoria controlada", "Análisis post-partido", "Reporte anclado al plan, con memoria que decide el staff."],
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "cockpit",
  "accent": "#5eead4",
  "density": "regular",
  "rivalGlow": true
}/*EDITMODE-END*/;

function App() {
  const [view, setView] = useSA("home");
  const [navOpen, setNavOpen] = useSA(false);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEA(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t.theme);
    root.style.setProperty("--dens", t.density === "compact" ? "0.78" : t.density === "comfy" ? "1.18" : "1");
    root.style.setProperty("--pad", t.density === "compact" ? "13px" : t.density === "comfy" ? "22px" : "18px");
    root.style.setProperty("--gap", t.density === "compact" ? "11px" : t.density === "comfy" ? "20px" : "16px");
    if (t.accent === "theme") root.style.removeProperty("--accent");
    else root.style.setProperty("--accent", t.accent);
  }, [t.theme, t.accent, t.density]);

  function go(v) { setView(v); setNavOpen(false); window.scrollTo({ top: 0 }); }
  const meta = META[view];

  return (
    <div className={`app-shell ${navOpen ? "nav-open" : ""}`}>
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)}></div>}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TL</div>
          <div>
            <span className="eyebrow">Coach room · Pro 3D</span>
            <h1>Tactical Lab Pro</h1>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-btn ${view === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
              <span className="nav-code">{n.code}</span>
              <span className="nav-label">{n.label}</span>
              <span className="nav-dot"></span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="status-card">
            <span className="eyebrow">Estado de campo</span>
            <div className="status-row"><span>Próximo</span><b>vs Atlético Norte</b></div>
            <div className="status-row"><span>Día</span><b>MD-3</b></div>
            <div className="status-row"><span>Plantel</span><b>12 / 14</b></div>
          </div>
          <div className="status-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="live-pill"><i></i>Local · IndexedDB</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted-2)" }}>autosave</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="icon-btn menu-toggle" onClick={() => setNavOpen(true)} style={{ width: 38, height: 38 }}>☰</button>
              <span className="eyebrow">{meta[0]}</span>
            </div>
            <h2>{meta[1]}</h2>
            <p>{meta[2]}</p>
          </div>
          <div className="top-actions">
            <span className="chip"><span className="status-dot available"></span>Sesión guardada</span>
            <button className="btn ghost" onClick={() => go("viewer")}>Modo presentación</button>
          </div>
        </header>

        {view === "home" && <HomeView go={go} />}
        {view === "viewer" && <ViewerView />}
        {view === "team" && <TeamView />}
        {view === "ai" && <AiView />}
        {view === "video" && <VideoView />}
        {view === "post" && <PostMatchView go={go} />}
      </main>

      <TweaksPanel>
        <TweakSection label="Dirección estética" />
        <TweakRadio label="Tema" value={t.theme} options={["cockpit", "broadcast", "pizarra"]} onChange={(v) => setTweak("theme", v)} />
        <p className="mono" style={{ fontSize: 10, color: "var(--muted-2)", margin: "2px 2px 8px", lineHeight: 1.5 }}>
          cockpit = ADN actual · broadcast = premium cinematográfico · pizarra = editorial data-dense
        </p>
        <TweakColor label="Acento" value={t.accent} options={["#5eead4", "#bef264", "#60a5fa", "#f5b971", "#c084fc"]} onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Densidad" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
