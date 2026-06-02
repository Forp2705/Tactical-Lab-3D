import type {
  CoachShapeContext,
  CoachShapePlayer,
  LineupLabShape,
} from "@/state/useAppStore";
import type { Player, Vec2 } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import { OpponentScoutPanel } from "@/scout/OpponentScoutPanel";
import { type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from "react";
import { GameModelBuilder } from "./GameModelBuilder";
import { ScenarioSimulatorPanel } from "./ScenarioSimulatorPanel";
import { explainShapeMetrics } from "./metricExplanations";
import { computeMetrics } from "./lib/shapeMetrics";
import { analyzePlayerFit } from "@/ai/playerFit";
import { FitChip, PitchViz } from "@/ui/tacticalPrimitives";

type LineupSlot = {
  playerId: string;
  slot: string;
  x: number;
  y: number;
};

const PITCH_W = 100;
const PITCH_H = 64;
const sx = (x: number) => (x / 100) * PITCH_W;
const sy = (y: number) => (y / 100) * PITCH_H;

const FORMATIONS: Record<string, Array<Omit<LineupSlot, "playerId">>> = {
  "4-3-3": [
    slot("GK", 7, 50),
    slot("LB", 24, 20),
    slot("CB", 23, 41),
    slot("CB", 23, 59),
    slot("RB", 24, 80),
    slot("CM", 47, 32),
    slot("CDM", 42, 50),
    slot("CM", 47, 68),
    slot("LW", 73, 22),
    slot("ST", 80, 50),
    slot("RW", 73, 78),
  ],
  "4-4-2": [
    slot("GK", 7, 50),
    slot("LB", 24, 20),
    slot("CB", 23, 41),
    slot("CB", 23, 59),
    slot("RB", 24, 80),
    slot("LM", 49, 20),
    slot("CM", 48, 41),
    slot("CM", 48, 59),
    slot("RM", 49, 80),
    slot("ST", 78, 42),
    slot("ST", 78, 58),
  ],
  "4-2-3-1": [
    slot("GK", 7, 50),
    slot("LB", 24, 20),
    slot("CB", 23, 41),
    slot("CB", 23, 59),
    slot("RB", 24, 80),
    slot("CDM", 42, 42),
    slot("CDM", 42, 58),
    slot("LW", 64, 22),
    slot("CAM", 60, 50),
    slot("RW", 64, 78),
    slot("ST", 80, 50),
  ],
  "3-5-2": [
    slot("GK", 7, 50),
    slot("CB", 23, 34),
    slot("CB", 21, 50),
    slot("CB", 23, 66),
    slot("LWB", 48, 17),
    slot("CM", 49, 38),
    slot("CDM", 44, 50),
    slot("CM", 49, 62),
    slot("RWB", 48, 83),
    slot("ST", 78, 42),
    slot("ST", 78, 58),
  ],
};

const STATUS_LABEL: Record<Player["status"], string> = {
  available: "Disponible",
  doubt: "Duda",
  injured: "Lesionado",
  suspended: "Suspendido",
};

export function TeamView() {
  const team = useAppStore((state) => state.team);
  const coachShapeContext = useAppStore((state) => state.coachShapeContext);
  const [activeTab, setActiveTab] = useState<"lineup" | "model" | "simulator" | "scout">("lineup");
  const [formation, setFormation] = useState("4-3-3");
  const [lineup, setLineup] = useState<LineupSlot[]>(() =>
    buildLineup(team.players, "4-3-3"),
  );
  const [selectedIdx, setSelectedIdx] = useState(4);
  const [showRival, setShowRival] = useState(true);
  const [published, setPublished] = useState(false);

  const playersById = useMemo(
    () => Object.fromEntries(team.players.map((player) => [player.id, player])),
    [team.players],
  );
  const selectedPlayer = lineup[selectedIdx]
    ? playersById[lineup[selectedIdx].playerId]
    : null;
  const onPitch = useMemo(
    () => new Set(lineup.map((item) => item.playerId)),
    [lineup],
  );
  const bench = team.players.filter((player) => !onPitch.has(player.id));

  function changeFormation(nextFormation: string) {
    setFormation(nextFormation);
    setLineup(buildLineup(team.players, nextFormation));
    setSelectedIdx(4);
    setPublished(false);
  }

  function moveSlot(index: number, pos: Vec2) {
    setLineup((current) =>
      current.map((item, idx) =>
        idx === index ? { ...item, x: pos.x, y: pos.y } : item,
      ),
    );
    setPublished(false);
  }

  function publishShape() {
    const shape = shapeFromLineup(formation, lineup, playersById);
    useAppStore.getState().setLineupLabShapes([shape]);
    useAppStore.getState().setCoachShapeContext(
      coachContextFromShape(formation, shape, lineup, playersById),
    );
    setPublished(true);
  }

  return (
    <div className="view-enter team-mock-view">
      <div className="team-mock-toolbar">
        <div className="segmented">
          <button
            type="button"
            className={activeTab === "lineup" ? "active" : ""}
            onClick={() => setActiveTab("lineup")}
          >
            Lineup
          </button>
          <button
            type="button"
            className={activeTab === "model" ? "active" : ""}
            onClick={() => setActiveTab("model")}
          >
            Modelo
          </button>
          <button
            type="button"
            className={activeTab === "simulator" ? "active" : ""}
            onClick={() => setActiveTab("simulator")}
          >
            Simulador
          </button>
          <button
            type="button"
            className={activeTab === "scout" ? "active" : ""}
            onClick={() => setActiveTab("scout")}
          >
            Scout
          </button>
        </div>
      </div>

      {activeTab === "model" ? <GameModelBuilder /> : null}
      {activeTab === "simulator" ? <ScenarioSimulatorPanel /> : null}
      {activeTab === "scout" ? <OpponentScoutPanel /> : null}

      {activeTab === "lineup" ? (
        <>
      <div className="team-mock-toolbar">
        <div className="segmented">
          {Object.keys(FORMATIONS).map((item) => (
            <button
              type="button"
              key={item}
              className={formation === item ? "active" : ""}
              onClick={() => changeFormation(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost team-mock-toggle"
          onClick={() => setShowRival((value) => !value)}
        >
          Overlay rival {showRival ? "on" : "off"}
        </button>
        <div className="team-mock-spacer" />
        <button
          type="button"
          className={`btn ${published ? "ghost" : "primary"}`}
          onClick={publishShape}
        >
          {published
            ? "Shape publicado al asistente"
            : "Publicar shape al asistente"}
        </button>
      </div>

      <div className="team-grid team-mock-grid">
        <div className="card team-lineup-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Lineup Lab · arrastra los jugadores</span>
              <h3>{formation} · salida asimetrica</h3>
            </div>
            <span className="chip">{lineup.length} en cancha</span>
          </div>
          <TeamLineupPitch
            lineup={lineup}
            playersById={playersById}
            selectedIdx={selectedIdx}
            showRival={showRival}
            onMove={moveSlot}
            onSelect={(index) => {
              setSelectedIdx(index);
              const playerId = lineup[index]?.playerId;
              if (playerId) {
                useAppStore.getState().setSelectedPlayerId(playerId);
              }
            }}
          />
          <p className="mono team-mock-hint">
            El snapshot del shape se inyecta como contexto al asistente tactico.
          </p>
          <ShapeMetricsPanel
            metrics={coachShapeContext?.currentMetrics}
            players={team.players}
          />
        </div>

        <aside className="grid team-mock-side">
          {selectedPlayer ? (
            <div className="card team-player-detail-card">
              <div className="card-head">
                <div className="team-selected-head">
                  <div
                    className={`num ${selectedPlayer.positions[0] === "GK" ? "gk" : ""}`}
                  >
                    {selectedPlayer.num}
                  </div>
                  <div>
                    <h3>{selectedPlayer.name}</h3>
                    <span className="mono">
                      {selectedPlayer.positions.join(" · ")} · pie{" "}
                      {selectedPlayer.foot}
                    </span>
                  </div>
                </div>
                <span className="team-status-mini">
                  <span className={`status-dot ${selectedPlayer.status}`} />
                  <span className="mono">
                    {STATUS_LABEL[selectedPlayer.status]}
                  </span>
                </span>
              </div>
              <p className="team-profile-copy">{selectedPlayer.profile}</p>
              <div className="team-qual-list">
                <div>
                  <span className="eyebrow">Rol natural</span>
                  <b>{selectedPlayer.positions.join(" / ")}</b>
                </div>
                <div>
                  <span className="eyebrow">Perfil de uso</span>
                  <b>{selectedPlayer.profile}</b>
                </div>
                <div>
                  <span className="eyebrow">Disponibilidad</span>
                  <b>{STATUS_LABEL[selectedPlayer.status]}</b>
                </div>
                <div>
                  <span className="eyebrow">Pie</span>
                  <b>{footLabel(selectedPlayer.foot)}</b>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card team-bench-card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Plantel</span>
                <h3>Banco y alternativas</h3>
              </div>
            </div>
            <div className="team-bench-list">
              {(bench.length ? bench : team.players).map((player) => (
                <button
                  type="button"
                  key={player.id}
                  className="player-row"
                  onClick={() => useAppStore.getState().setSelectedPlayerId(player.id)}
                >
                  <div
                    className={`num ${player.positions[0] === "GK" ? "gk" : ""}`}
                  >
                    {player.num}
                  </div>
                  <div>
                    <b>{player.name}</b>
                    <small className="mono">
                      {player.positions.join(" · ")}
                    </small>
                  </div>
                  <span className="team-status-mini">
                    <span className={`status-dot ${player.status}`} />
                    <span className="mono">
                      {STATUS_LABEL[player.status].slice(0, 4)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
        </>
      ) : null}
    </div>
  );
}

function ShapeMetricsPanel({
  metrics,
  players,
}: {
  metrics: CoachShapeContext["currentMetrics"];
  players: Player[];
}) {
  const explanations = explainShapeMetrics(metrics);
  const fitFindings = analyzePlayerFit(players, ["highBlock", "freeFullback"]);
  if (!explanations.length) {
    return (
      <div className="coach-report-card" style={{ marginTop: 12 }}>
        <span className="panel-eyebrow">Metricas explicadas</span>
        <p>Publica el shape para ver ancho, profundidad, compacidad y riesgos.</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: 12 }}>
        <PitchViz
          title="Cancha analitica"
          subtitle="ancho / profundidad / altura"
          overlays={[
            {
              type: "zone",
              x: 18,
              y: 12,
              w: Math.min(64, Math.max(24, metrics?.depth ?? 34)),
              h: Math.min(42, Math.max(18, metrics?.width ?? 28)),
              tone:
                (metrics?.compactness ?? 0) > 28
                  ? "danger"
                  : (metrics?.compactness ?? 0) > 22
                    ? "warn"
                    : "good",
              label: "estructura",
            },
            {
              type: "blockHeight",
              x: Math.min(90, Math.max(10, metrics?.blockHeight ?? 50)),
              tone: (metrics?.blockHeight ?? 0) > 72 ? "warn" : "info",
              label: "bloque",
            },
          ]}
        />
      </div>
      <div className="coach-report-grid" style={{ marginTop: 12 }}>
        {explanations.map((item) => (
          <article className={`coach-report-card ${item.tone}`} key={item.id}>
            <span className="panel-eyebrow">{item.label}</span>
            <h4>{item.value}</h4>
            <p>{item.reading}</p>
            <small>{item.risk}</small>
          </article>
        ))}
      </div>
      {fitFindings.length ? (
        <div className="toolbar compact" style={{ flexWrap: "wrap", marginTop: 12 }}>
          {fitFindings.slice(0, 4).map((finding) => (
            <FitChip level={finding.level} key={finding.id}>
              {finding.statement}
            </FitChip>
          ))}
        </div>
      ) : null}
    </>
  );
}

function TeamLineupPitch({
  lineup,
  playersById,
  selectedIdx,
  showRival,
  onMove,
  onSelect,
}: {
  lineup: LineupSlot[];
  playersById: Record<string, Player>;
  selectedIdx: number;
  showRival: boolean;
  onMove: (index: number, pos: Vec2) => void;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragIdx = useRef<number | null>(null);

  function pointerToCoord(event: PointerEvent | ReactPointerEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(5, Math.min(95, y)),
    };
  }

  function handleDown(index: number, event: ReactPointerEvent) {
    event.preventDefault();
    dragIdx.current = index;
    onSelect(index);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function handleMove(event: PointerEvent) {
    if (dragIdx.current == null) return;
    onMove(dragIdx.current, pointerToCoord(event));
  }

  function handleUp() {
    dragIdx.current = null;
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
  }

  return (
    <div className="pitch-wrap team-lineup-pitch" ref={ref}>
      <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} aria-label="Lineup board">
        {Array.from({ length: 10 }).map((_, index) => (
          <rect
            key={index}
            x={(index * PITCH_W) / 10}
            y={0}
            width={PITCH_W / 10}
            height={PITCH_H}
            fill={index % 2 ? "rgba(255,255,255,0.025)" : "transparent"}
          />
        ))}
        <PitchMarkings />
        {showRival
          ? [
              { x: 70, y: 50 },
              { x: 80, y: 30 },
              { x: 80, y: 70 },
              { x: 88, y: 50 },
            ].map((item, index) => (
              <circle
                key={index}
                cx={sx(item.x)}
                cy={sy(item.y)}
                r={2}
                fill="rgba(255,116,116,0.4)"
                stroke="rgba(255,116,116,0.7)"
                strokeWidth={0.3}
              />
            ))
          : null}
      </svg>
      {lineup.map((item, index) => {
        const player = playersById[item.playerId];
        if (!player) return null;
        const selected = selectedIdx === index;
        const isGk = item.slot === "GK";
        return (
          <div
            key={item.playerId}
            className="team-pitch-slot"
            onPointerDown={(event) => handleDown(index, event)}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              zIndex: selected ? 10 : 2,
            }}
          >
            <div
              className={`team-pitch-num ${isGk ? "gk" : ""} ${
                selected ? "selected" : ""
              }`}
            >
              {player.num}
            </div>
            <div className="team-pitch-name">{lastName(player.name)}</div>
            <div className="team-pitch-role">{item.slot}</div>
          </div>
        );
      })}
    </div>
  );
}

function PitchMarkings({ color = "rgba(255,255,255,0.55)" }) {
  const strokeWidth = 0.35;
  return (
    <g stroke={color} strokeWidth={strokeWidth} fill="none">
      <rect x={2} y={2} width={PITCH_W - 4} height={PITCH_H - 4} rx={1.2} />
      <line x1={PITCH_W / 2} y1={2} x2={PITCH_W / 2} y2={PITCH_H - 2} />
      <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={8} />
      <circle
        cx={PITCH_W / 2}
        cy={PITCH_H / 2}
        r={0.7}
        fill={color}
        stroke="none"
      />
      <rect x={2} y={PITCH_H / 2 - 13} width={11} height={26} />
      <rect x={2} y={PITCH_H / 2 - 6} width={4.5} height={12} />
      <rect x={PITCH_W - 13} y={PITCH_H / 2 - 13} width={11} height={26} />
      <rect x={PITCH_W - 6.5} y={PITCH_H / 2 - 6} width={4.5} height={12} />
      <path d={`M 13 ${PITCH_H / 2 - 5} A 6 6 0 0 1 13 ${PITCH_H / 2 + 5}`} />
      <path
        d={`M ${PITCH_W - 13} ${PITCH_H / 2 - 5} A 6 6 0 0 0 ${PITCH_W - 13} ${
          PITCH_H / 2 + 5
        }`}
      />
    </g>
  );
}

function buildLineup(players: Player[], formation: string): LineupSlot[] {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const used = new Set<string>();
  return slots.map((formationSlot) => {
    const exact = players.find(
      (player) => !used.has(player.id) && compatibleRole(player, formationSlot.slot),
    );
    const fallback = players.find((player) => !used.has(player.id));
    const selected = exact ?? fallback;
    if (selected) used.add(selected.id);
    return {
      ...formationSlot,
      playerId: selected?.id ?? "",
    };
  });
}

function shapeFromLineup(
  formation: string,
  lineup: LineupSlot[],
  playersById: Record<string, Player>,
): LineupLabShape {
  return {
    id: "team-mock-current-shape",
    name: `${formation} publicado`,
    phase: "buildup",
    positions: Object.fromEntries(
      lineup
        .filter((item) => playersById[item.playerId])
        .map((item) => [item.playerId, { x: item.x, y: item.y }]),
    ),
    notes: "Shape publicado desde Equipo.",
    createdAt: Date.now(),
  };
}

function coachContextFromShape(
  formation: string,
  shape: LineupLabShape,
  lineup: LineupSlot[],
  playersById: Record<string, Player>,
): CoachShapeContext {
  const players = lineup
    .filter((item) => playersById[item.playerId] && shape.positions[item.playerId])
    .map((item) => {
      const player = playersById[item.playerId];
      return {
        playerId: item.playerId,
        name: player.name,
        role: item.slot,
        x: Math.round(item.x * 10) / 10,
        y: Math.round(item.y * 10) / 10,
      };
    });
  const summary = summarizeBoard(players);
  const metrics = computeMetrics(
    players.map((player) => ({
      id: player.playerId,
      role: player.role,
      pos: { x: player.x, y: player.y },
    })),
  );
  return {
    formation,
    selectedShapeId: shape.id,
    selectedShapeName: shape.name,
    currentBoardSummary: summary,
    currentMetrics: metrics,
    currentBoard: players,
    shapes: [
      {
        id: shape.id,
        name: shape.name,
        phase: shape.phase,
        notes: shape.notes,
        summary,
        metrics,
        players,
      },
    ],
  };
}

function summarizeBoard(players: CoachShapePlayer[]) {
  if (!players.length) return "Sin shape publicado.";
  const width =
    Math.max(...players.map((player) => player.y)) -
    Math.min(...players.map((player) => player.y));
  const depth =
    Math.max(...players.map((player) => player.x)) -
    Math.min(...players.map((player) => player.x));
  return `ancho ${width.toFixed(1)} / profundidad ${depth.toFixed(1)} / ${players.length} jugadores`;
}

function compatibleRole(player: Player, role: string) {
  const normalized = normalizeRole(role);
  return player.positions.some(
    (position) =>
      normalizeRole(position) === normalized ||
      compatibleRoleAliases(normalized).includes(position),
  );
}

function compatibleRoleAliases(role: string) {
  const aliases: Record<string, Player["positions"]> = {
    WB: ["LB", "RB", "WB"],
    LW: ["LW", "RW", "AM"],
    RW: ["RW", "LW", "AM"],
    CAM: ["CAM", "AM", "CM"],
    CDM: ["CDM", "CM", "CB"],
    CB: ["CB", "CDM"],
    ST: ["ST", "CAM"],
  };
  return aliases[role] ?? [role as Player["positions"][number]];
}

function normalizeRole(role: string) {
  if (role === "LWB" || role === "RWB") return "WB";
  if (role === "LM") return "LW";
  if (role === "RM") return "RW";
  if (role === "DM") return "CDM";
  if (role === "AM") return "CAM";
  return role;
}

function slot(slotName: string, x: number, y: number) {
  return { slot: slotName, x, y };
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function footLabel(foot: Player["foot"]) {
  if (foot === "L") return "Zurdo";
  if (foot === "R") return "Derecho";
  return "Ambos perfiles";
}
