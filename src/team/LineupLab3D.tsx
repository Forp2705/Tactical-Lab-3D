import type { Lineup, Player, Vec2 } from "@/data";
import type {
  CoachShapeContext,
  CoachShapePlayer,
  LabShapePhase,
  LineupLabSavedTransition,
  LineupLabShape,
} from "@/state/useAppStore";
import { useAppStore } from "@/state/useAppStore";
import { Pitch3D } from "@/viewer/Pitch3D";
import {
  clampPitch,
  pitchDimensions,
  pitchToWorld,
  worldToPitch,
} from "@/viewer/lib/coords";
import {
  Billboard,
  ContactShadows,
  Environment,
  Line,
  OrthographicCamera,
  Text,
} from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  type Group,
  SRGBColorSpace,
  Vector3,
} from "three";

type FormationSlot = {
  role: string;
  pos: Vec2;
};

type ShapePhase = LabShapePhase;
type Shape = LineupLabShape;
type SavedTransition = LineupLabSavedTransition;

type DragTarget =
  | { kind: "own"; playerId: string }
  | { kind: "rival"; rivalId: string };

type RivalChip = {
  id: string;
  num: number;
  role: string;
};

type LabSnapshot = {
  ownPositions: Record<string, Vec2>;
  rivalPositions: Record<string, Vec2>;
  shapes: Shape[];
  savedTransitions: SavedTransition[];
  rivals: RivalChip[];
};

const FORMATIONS: Record<string, FormationSlot[]> = {
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
  "4-1-4-1": [
    slot("GK", 7, 50),
    slot("LB", 24, 20),
    slot("CB", 23, 41),
    slot("CB", 23, 59),
    slot("RB", 24, 80),
    slot("CDM", 40, 50),
    slot("LM", 57, 20),
    slot("CM", 56, 41),
    slot("CM", 56, 59),
    slot("RM", 57, 80),
    slot("ST", 80, 50),
  ],
  "4-3-1-2": [
    slot("GK", 7, 50),
    slot("LB", 24, 20),
    slot("CB", 23, 41),
    slot("CB", 23, 59),
    slot("RB", 24, 80),
    slot("CM", 47, 34),
    slot("CDM", 42, 50),
    slot("CM", 47, 66),
    slot("CAM", 63, 50),
    slot("ST", 80, 42),
    slot("ST", 80, 58),
  ],
  "3-4-3": [
    slot("GK", 7, 50),
    slot("CB", 23, 34),
    slot("CB", 21, 50),
    slot("CB", 23, 66),
    slot("LWB", 48, 17),
    slot("CM", 48, 41),
    slot("CM", 48, 59),
    slot("RWB", 48, 83),
    slot("LW", 76, 24),
    slot("ST", 82, 50),
    slot("RW", 76, 76),
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
  "5-3-2": [
    slot("GK", 7, 50),
    slot("LWB", 30, 16),
    slot("CB", 24, 36),
    slot("CB", 22, 50),
    slot("CB", 24, 64),
    slot("RWB", 30, 84),
    slot("CM", 52, 38),
    slot("CDM", 46, 50),
    slot("CM", 52, 62),
    slot("ST", 78, 42),
    slot("ST", 78, 58),
  ],
  "5-4-1": [
    slot("GK", 7, 50),
    slot("LWB", 30, 16),
    slot("CB", 24, 36),
    slot("CB", 22, 50),
    slot("CB", 24, 64),
    slot("RWB", 30, 84),
    slot("LM", 56, 22),
    slot("CM", 52, 42),
    slot("CM", 52, 58),
    slot("RM", 56, 78),
    slot("ST", 80, 50),
  ],
};

const DEFAULT_RIVALS: RivalChip[] = [
  { id: "rv-gk", num: 1, role: "GK" },
  { id: "rv-lb", num: 3, role: "LB" },
  { id: "rv-cb1", num: 4, role: "CB" },
  { id: "rv-cb2", num: 5, role: "CB" },
  { id: "rv-rb", num: 2, role: "RB" },
  { id: "rv-dm", num: 6, role: "CDM" },
  { id: "rv-cm1", num: 8, role: "CM" },
  { id: "rv-cm2", num: 10, role: "CAM" },
  { id: "rv-lw", num: 11, role: "LW" },
  { id: "rv-st", num: 9, role: "ST" },
  { id: "rv-rw", num: 7, role: "RW" },
];

const RIVAL_BASE = [
  slot("GK", 93, 50),
  slot("LB", 76, 80),
  slot("CB", 77, 59),
  slot("CB", 77, 41),
  slot("RB", 76, 20),
  slot("CDM", 58, 50),
  slot("CM", 53, 62),
  slot("CAM", 48, 42),
  slot("LW", 31, 78),
  slot("ST", 22, 50),
  slot("RW", 31, 22),
];

export function LineupLab3D({ players }: { players: Player[] }) {
  const pendingShapeId = useAppStore(
    (state) => state.lineupLab.pendingShapeId,
  );
  const setLineupLabShapes = useAppStore((state) => state.setLineupLabShapes);
  const setLineupLabTransitions = useAppStore(
    (state) => state.setLineupLabTransitions,
  );
  const consumePendingShape = useAppStore(
    (state) => state.consumePendingShape,
  );
  const [formation, setFormation] = useState("4-3-3");
  const [snap, setSnap] = useState(true);
  const [showRival, setShowRival] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [rivals, setRivals] = useState<RivalChip[]>(DEFAULT_RIVALS);
  const [history, setHistory] = useState<LabSnapshot[]>([]);
  const [assignments, setAssignments] = useState<string[]>(() =>
    autoAssign(players, FORMATIONS["4-3-3"]),
  );
  const [ownPositions, setOwnPositions] = useState<Record<string, Vec2>>(() =>
    positionsFromAssignments(
      autoAssign(players, FORMATIONS["4-3-3"]),
      FORMATIONS["4-3-3"],
    ),
  );
  const [rivalPositions, setRivalPositions] = useState<Record<string, Vec2>>(
    () => rivalBasePositions(),
  );
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    assignments[0] ?? null,
  );
  const [shapes, setShapes] = useState<Shape[]>(() => {
    const stored = useAppStore.getState().lineupLab.shapes;
    return stored.length ? cloneShapes(stored) : defaultShapes(players);
  });
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(
    () => shapes[0]?.id ?? null,
  );
  const [fromShapeId, setFromShapeId] = useState<string | null>(
    () => shapes[0]?.id ?? null,
  );
  const [toShapeId, setToShapeId] = useState<string | null>(
    () => shapes[1]?.id ?? null,
  );
  const [transition, setTransition] = useState(0);
  const [transitionPlaying, setTransitionPlaying] = useState(false);
  const [savedTransitions, setSavedTransitions] = useState<SavedTransition[]>(
    () => {
      const stored = useAppStore.getState().lineupLab.savedTransitions;
      return stored.length
        ? stored.map((transitionPreset) => ({ ...transitionPreset }))
        : defaultTransitions(shapes);
    },
  );
  const slots = FORMATIONS[formation];
  const ownChips = useMemo(
    () =>
      assignments
        .map((playerId, index) => {
          const player = players.find((item) => item.id === playerId);
          if (!player) return null;
          return {
            player,
            role: slots[index]?.role ?? player.positions[0] ?? "CM",
            pos: ownPositions[player.id] ??
              slots[index]?.pos ?? { x: 50, y: 50 },
          };
        })
        .filter((chip): chip is { player: Player; role: string; pos: Vec2 } =>
          Boolean(chip),
        ),
    [assignments, ownPositions, players, slots],
  );
  const rivalChips = useMemo(
    () =>
      rivals.map((rival, index) => ({
        rival,
        role: rival.role,
        pos: rivalPositions[rival.id] ??
          RIVAL_BASE[index]?.pos ?? { x: 50, y: 50 },
      })),
    [rivalPositions, rivals],
  );
  const metrics = useMemo(
    () => computeMetrics(ownChips, showRival ? rivalChips : []),
    [ownChips, rivalChips, showRival],
  );
  const fromShape = shapes.find((shape) => shape.id === fromShapeId);
  const toShape = shapes.find((shape) => shape.id === toShapeId);
  const selectedShape = shapes.find((shape) => shape.id === selectedShapeId);
  const transitionDistances = useMemo(
    () => computeTransitionDistances(players, fromShape, toShape),
    [players, fromShape, toShape],
  );
  const heatmapCells = useMemo(
    () => computeHeatmapCells(ownChips, showRival ? rivalChips : []),
    [ownChips, rivalChips, showRival],
  );

  useEffect(() => {
    if (!transitionPlaying || !fromShape || !toShape) return;
    let frame = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const value = Math.min(1, (now - start) / 3000);
      setTransition(value);
      setOwnPositions(
        blendPositions(fromShape.positions, toShape.positions, value),
      );
      if (value < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setTransitionPlaying(false);
        start = now;
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [fromShape, toShape, transitionPlaying]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setTransitionPlaying((value) => !value);
      } else if (event.key.toLowerCase() === "s") {
        setSnap((value) => !value);
      } else if (event.key.toLowerCase() === "r") {
        setShowRival((value) => !value);
      } else if (event.key.toLowerCase() === "l") {
        setShowLines((value) => !value);
      } else if (event.key.toLowerCase() === "m") {
        setShowMetrics((value) => !value);
      } else if (event.key.toLowerCase() === "h") {
        setShowHeatmap((value) => !value);
      } else if (event.key.toLowerCase() === "c") {
        setCompareMode((value) => !value);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    setLineupLabShapes(shapes);
  }, [setLineupLabShapes, shapes]);

  useEffect(() => {
    setLineupLabTransitions(savedTransitions);
  }, [savedTransitions, setLineupLabTransitions]);

  useEffect(() => {
    if (!pendingShapeId) return;
    const shape = shapes.find((item) => item.id === pendingShapeId);
    if (shape) loadShape(shape);
    consumePendingShape();
  }, [consumePendingShape, pendingShapeId, shapes]);

  useEffect(() => {
    useAppStore.getState().setCoachShapeContext(
      buildCoachShapeContext({
        formation,
        players,
        ownChips,
        shapes,
        savedTransitions,
        selectedShapeId,
        fromShapeId,
        toShapeId,
        rivalChips: showRival ? rivalChips : [],
      }),
    );

    return () => {
      useAppStore.getState().setCoachShapeContext(null);
    };
  }, [
    formation,
    fromShapeId,
    ownChips,
    players,
    rivalChips,
    savedTransitions,
    selectedShapeId,
    shapes,
    showRival,
    toShapeId,
  ]);

  function pushHistory() {
    const snapshot: LabSnapshot = {
      ownPositions: clonePositions(ownPositions),
      rivalPositions: clonePositions(rivalPositions),
      shapes: shapes.map((shape) => ({
        ...shape,
        positions: clonePositions(shape.positions),
      })),
      savedTransitions: savedTransitions.map((item) => ({ ...item })),
      rivals: rivals.map((rival) => ({ ...rival })),
    };
    setHistory((current) => [...current.slice(-24), snapshot]);
  }

  function undo() {
    const snapshot = history.at(-1);
    if (!snapshot) return;
    setOwnPositions(clonePositions(snapshot.ownPositions));
    setRivalPositions(clonePositions(snapshot.rivalPositions));
    setShapes(
      snapshot.shapes.map((shape) => ({
        ...shape,
        positions: clonePositions(shape.positions),
      })),
    );
    setSavedTransitions(snapshot.savedTransitions.map((item) => ({ ...item })));
    setRivals(snapshot.rivals.map((rival) => ({ ...rival })));
    setHistory((current) => current.slice(0, -1));
  }

  function beginDrag(target: DragTarget) {
    pushHistory();
    setDragTarget(target);
  }

  function changeFormation(nextFormation: string) {
    pushHistory();
    const nextSlots = FORMATIONS[nextFormation];
    const nextAssignments = preserveOrAutoAssign(
      assignments,
      players,
      nextSlots,
    );
    setFormation(nextFormation);
    setAssignments(nextAssignments);
    setOwnPositions((current) => ({
      ...positionsFromAssignments(nextAssignments, nextSlots),
      ...Object.fromEntries(
        Object.entries(current).filter(([id]) => nextAssignments.includes(id)),
      ),
    }));
  }

  function moveChip(target: DragTarget, rawPos: Vec2) {
    const pos = snap ? snapPitch(rawPos) : rawPos;
    if (target.kind === "own") {
      setOwnPositions((current) => ({ ...current, [target.playerId]: pos }));
    } else {
      setRivalPositions((current) => ({ ...current, [target.rivalId]: pos }));
    }
  }

  function captureShape(phase: ShapePhase) {
    pushHistory();
    const shape: Shape = {
      id: crypto.randomUUID(),
      name: `${formation} ${labelForPhase(phase)} ${shapes.length + 1}`,
      phase,
      positions: Object.fromEntries(
        ownChips.map((chip) => [chip.player.id, chip.pos]),
      ),
      notes: "",
      createdAt: Date.now(),
    };
    setShapes((current) => [...current, shape]);
    setSelectedShapeId(shape.id);
    if (!fromShapeId) setFromShapeId(shape.id);
    else if (!toShapeId) setToShapeId(shape.id);
  }

  function loadShape(shape: Shape) {
    pushHistory();
    setOwnPositions((current) => ({ ...current, ...shape.positions }));
    setSelectedShapeId(shape.id);
    setTransition(0);
  }

  function deleteShape(shapeId: string) {
    if (shapes.length <= 1) return;
    pushHistory();
    const nextShapes = shapes.filter((shape) => shape.id !== shapeId);
    setShapes(nextShapes);
    if (fromShapeId === shapeId) setFromShapeId(nextShapes[0]?.id ?? null);
    if (toShapeId === shapeId)
      setToShapeId(nextShapes[1]?.id ?? nextShapes[0]?.id ?? null);
    if (selectedShapeId === shapeId)
      setSelectedShapeId(nextShapes[0]?.id ?? null);
    setSavedTransitions((current) =>
      current.filter(
        (item) => item.fromShapeId !== shapeId && item.toShapeId !== shapeId,
      ),
    );
  }

  function updateShapeNotes(shapeId: string, notes: string) {
    setShapes((current) =>
      current.map((shape) =>
        shape.id === shapeId ? { ...shape, notes } : shape,
      ),
    );
  }

  function addRival() {
    pushHistory();
    const nextNum = Math.min(
      99,
      Math.max(1, ...rivals.map((rival) => rival.num)) + 1,
    );
    const id = `rv-custom-${Date.now()}`;
    const rival: RivalChip = { id, num: nextNum, role: "ST" };
    setRivals((current) => [...current, rival]);
    setRivalPositions((current) => ({
      ...current,
      [id]: snapPitch({ x: 50 + (rivals.length % 3) * 5, y: 50 }),
    }));
    setShowRival(true);
  }

  function removeRival(rivalId: string) {
    pushHistory();
    setRivals((current) => current.filter((rival) => rival.id !== rivalId));
    setRivalPositions((current) => {
      const next = { ...current };
      delete next[rivalId];
      return next;
    });
  }

  function exportLineupPng() {
    const canvas = document.querySelector(
      ".lineup-lab-canvas canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `lineup-lab-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function updateTransition(value: number) {
    setTransition(value);
    if (fromShape && toShape) {
      setOwnPositions(
        blendPositions(fromShape.positions, toShape.positions, value),
      );
    }
  }

  function resetTransition() {
    setTransitionPlaying(false);
    setCompareMode(false);
    updateTransition(0);
  }

  function saveTransitionPreset() {
    if (!fromShape || !toShape || fromShape.id === toShape.id) return;
    const transitionPreset: SavedTransition = {
      id: crypto.randomUUID(),
      name: `${fromShape.name} -> ${toShape.name}`,
      fromShapeId: fromShape.id,
      fromShapeName: fromShape.name,
      toShapeId: toShape.id,
      toShapeName: toShape.name,
      notes: selectedShape?.notes,
      createdAt: Date.now(),
    };
    setSavedTransitions((current) => [
      transitionPreset,
      ...current.filter(
        (item) =>
          item.fromShapeId !== transitionPreset.fromShapeId ||
          item.toShapeId !== transitionPreset.toShapeId,
      ),
    ]);
  }

  function loadTransitionPreset(transitionPreset: SavedTransition) {
    setFromShapeId(transitionPreset.fromShapeId);
    setToShapeId(transitionPreset.toShapeId);
    setCompareMode(false);
    setTransitionPlaying(false);
    setTransition(0);
  }

  function deleteTransitionPreset(transitionId: string) {
    setSavedTransitions((current) =>
      current.filter((item) => item.id !== transitionId),
    );
  }

  function saveCurrentLineup(apply = false) {
    const lineup: Lineup = {
      id: crypto.randomUUID(),
      name: `${formation} Lab ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      formation,
      ownPositions: ownChips.map((chip) => ({
        playerId: chip.player.id,
        pos: chip.pos,
        role: chip.role,
      })),
      rivalPositions: showRival
        ? rivalChips.map((chip) => ({
            pos: chip.pos,
            role: chip.role,
          }))
        : undefined,
    };
    useAppStore.getState().addLineup(lineup);
    if (apply) useAppStore.getState().applyLineupToViewer(lineup.id);
  }

  return (
    <section className="lineup-lab">
      <div className="lineup-lab-topbar">
        <div>
          <h3>Lineup Lab 3D</h3>
          <p>
            Arrastra fichas, guarda shapes y simula transiciones ataque-defensa.
          </p>
        </div>
        <div className="lineup-lab-actions">
          <select
            value={formation}
            onChange={(event) => changeFormation(event.target.value)}
          >
            {Object.keys(FORMATIONS).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              pushHistory();
              const next = autoAssign(players, slots);
              setAssignments(next);
              setOwnPositions(positionsFromAssignments(next, slots));
            }}
          >
            Auto once
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setSnap((value) => !value)}
          >
            Snap {snap ? "on" : "off"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowRival((value) => !value)}
          >
            Rival {showRival ? "on" : "off"}
          </button>
        </div>
      </div>

      <div className="lineup-lab-main">
        <div className="lineup-lab-canvas">
          <Canvas
            shadows="soft"
            dpr={[1, 1.25]}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.08;
              gl.outputColorSpace = SRGBColorSpace;
            }}
          >
            <color attach="background" args={["#07131e"]} />
            <fog attach="fog" args={["#07131e", 110, 230]} />
            <OrthographicCamera
              makeDefault
              position={[0, 130, 0]}
              rotation={[-Math.PI / 2, 0, Math.PI / 2]}
              zoom={5.05}
            />
            <Environment preset="park" background={false} blur={0.35} />
            <hemisphereLight intensity={0.82} groundColor="#315f35" />
            <directionalLight
              position={[20, 42, 18]}
              intensity={1.35}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-radius={6}
              shadow-bias={-0.0001}
            />
            <Pitch3D mode="full" />
            <ContactShadows
              position={[0, 0.08, 0]}
              opacity={0.24}
              blur={3}
              far={8}
              resolution={512}
              scale={130}
            />
            <DragPlane
              dragTarget={dragTarget}
              snap={snap}
              onMove={moveChip}
              onRelease={() => setDragTarget(null)}
            />
            {showHeatmap ? <HeatmapLayer cells={heatmapCells} /> : null}
            {fromShape && toShape ? (
              <TransitionTrails
                players={players}
                fromShape={fromShape}
                toShape={toShape}
                visible={
                  compareMode ||
                  transitionPlaying ||
                  (transition > 0 && transition < 1)
                }
              />
            ) : null}
            {compareMode && toShape ? (
              <ComparisonGhosts
                players={players}
                positions={toShape.positions}
              />
            ) : null}
            {showLines ? (
              <TacticalLines chips={ownChips} metrics={metrics} />
            ) : null}
            {showMetrics ? <MetricsMarkers metrics={metrics} /> : null}
            {ownChips.map((chip) => (
              <TacticalChip
                key={chip.player.id}
                id={chip.player.id}
                team="own"
                num={chip.player.num}
                label={lastName(chip.player.name)}
                role={chip.role}
                pos={chip.pos}
                selected={selectedId === chip.player.id}
                dragging={
                  dragTarget?.kind === "own" &&
                  dragTarget.playerId === chip.player.id
                }
                onPointerDown={() => {
                  setSelectedId(chip.player.id);
                  useAppStore.getState().setSelectedPlayerId(chip.player.id);
                  beginDrag({ kind: "own", playerId: chip.player.id });
                }}
              />
            ))}
            {showRival
              ? rivalChips.map((chip) => (
                  <TacticalChip
                    key={chip.rival.id}
                    id={chip.rival.id}
                    team="rival"
                    num={chip.rival.num}
                    label={`Rival ${chip.rival.num}`}
                    role={chip.role}
                    pos={chip.pos}
                    selected={
                      dragTarget?.kind === "rival" &&
                      dragTarget.rivalId === chip.rival.id
                    }
                    dragging={
                      dragTarget?.kind === "rival" &&
                      dragTarget.rivalId === chip.rival.id
                    }
                    onPointerDown={() =>
                      beginDrag({ kind: "rival", rivalId: chip.rival.id })
                    }
                  />
                ))
              : null}
          </Canvas>
        </div>

        <aside className="lineup-lab-panel">
          <div className="lab-panel-card">
            <h4>Shapes</h4>
            <div className="shape-capture-grid">
              {(
                [
                  "attack",
                  "defense",
                  "transition",
                  "buildup",
                  "abp",
                ] as ShapePhase[]
              ).map((phase) => (
                <button
                  key={phase}
                  type="button"
                  className="secondary"
                  onClick={() => captureShape(phase)}
                >
                  Capturar {labelForPhase(phase)}
                </button>
              ))}
            </div>
            <div className="shape-list">
              {shapes.map((shape) => (
                <div
                  key={shape.id}
                  className={`shape-row-wrap ${
                    selectedShapeId === shape.id ? "active" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="shape-row"
                    onClick={() => loadShape(shape)}
                  >
                    <ShapeMiniMap positions={shape.positions} />
                    <span>
                      <b>{shape.name}</b>
                      <small>{labelForPhase(shape.phase)}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="secondary tiny-button"
                    disabled={shapes.length <= 1}
                    onClick={() => deleteShape(shape.id)}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
            {selectedShape ? (
              <label className="shape-notes">
                Notas del shape
                <textarea
                  value={selectedShape.notes ?? ""}
                  onChange={(event) =>
                    updateShapeNotes(selectedShape.id, event.target.value)
                  }
                  placeholder="Ej: bloque medio, lateral salta solo con pase orientado..."
                />
              </label>
            ) : null}
          </div>

          <div className="lab-panel-card">
            <h4>Transicion ataque-defensa</h4>
            <div className="two-col">
              <label>
                Desde
                <select
                  value={fromShapeId ?? ""}
                  onChange={(event) => setFromShapeId(event.target.value)}
                >
                  {shapes.map((shape) => (
                    <option key={shape.id} value={shape.id}>
                      {shape.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Hasta
                <select
                  value={toShapeId ?? ""}
                  onChange={(event) => setToShapeId(event.target.value)}
                >
                  {shapes.map((shape) => (
                    <option key={shape.id} value={shape.id}>
                      {shape.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={transition}
              onChange={(event) => updateTransition(Number(event.target.value))}
            />
            <div className="toolbar compact">
              <button
                type="button"
                onClick={() => {
                  setCompareMode(false);
                  setTransitionPlaying(true);
                }}
              >
                Play transición
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setCompareMode((value) => !value)}
              >
                Comparar {compareMode ? "on" : "off"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={resetTransition}
              >
                Reset
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!fromShape || !toShape || fromShape.id === toShape.id}
                onClick={saveTransitionPreset}
              >
                Guardar transiciÃ³n
              </button>
            </div>
            {savedTransitions.length ? (
              <div className="distance-list">
                {savedTransitions.map((item) => (
                  <div key={item.id}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => loadTransitionPreset(item)}
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      className="secondary tiny-button"
                      onClick={() => deleteTransitionPreset(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="distance-list">
              {transitionDistances.slice(0, 4).map((entry) => (
                <div key={entry.playerId}>
                  <span>{entry.name}</span>
                  <b>{entry.distance.toFixed(1)}m</b>
                </div>
              ))}
            </div>
          </div>

          <div className="lab-panel-card">
            <h4>Metricas tacticas</h4>
            <div className="metrics-grid">
              <Metric label="Ancho" value={`${metrics.width.toFixed(1)}m`} />
              <Metric
                label="Profundidad"
                value={`${metrics.depth.toFixed(1)}m`}
              />
              <Metric
                label="Compacidad"
                value={`${metrics.compactness.toFixed(1)}m`}
              />
              <Metric label="Duelos" value={String(metrics.duels)} />
              <Metric label="Heat" value={`${metrics.heatScore.toFixed(0)}%`} />
            </div>
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={showLines}
                onChange={() => setShowLines((value) => !value)}
              />
              Lineas tacticas
            </label>
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={showMetrics}
                onChange={() => setShowMetrics((value) => !value)}
              />
              Centro de masa y badges
            </label>
            <label className="toggle-line">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={() => setShowHeatmap((value) => !value)}
              />
              Heatmap de espacios
            </label>
          </div>

          <div className="lab-panel-card">
            <h4>Rivales</h4>
            <div className="toolbar compact">
              <button type="button" onClick={addRival}>
                Agregar rival
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowRival((value) => !value)}
              >
                Rival {showRival ? "on" : "off"}
              </button>
            </div>
            <div className="rival-list">
              {rivals.map((rival) => (
                <div key={rival.id} className="rival-row">
                  <span>
                    #{rival.num} {rival.role}
                  </span>
                  <button
                    type="button"
                    className="secondary tiny-button"
                    disabled={rivals.length <= 1}
                    onClick={() => removeRival(rival.id)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lab-panel-card">
            <h4>Guardar y usar</h4>
            <div className="toolbar compact">
              <button type="button" onClick={() => saveCurrentLineup(false)}>
                Guardar lineup
              </button>
              <button type="button" onClick={() => saveCurrentLineup(true)}>
                Usar en visor
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!history.length}
                onClick={undo}
              >
                Undo
              </button>
              <button
                type="button"
                className="secondary"
                onClick={exportLineupPng}
              >
                Export PNG
              </button>
            </div>
            <p className="muted">
              Esto crea una instancia nueva desde el shape actual; no pisa el
              catalogo.
            </p>
            <p className="muted">
              Atajos: espacio play, Ctrl+Z undo, S snap, R rival, L lineas, M
              metricas, H heatmap, C comparar.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DragPlane({
  dragTarget,
  snap,
  onMove,
  onRelease,
}: {
  dragTarget: DragTarget | null;
  snap: boolean;
  onMove: (target: DragTarget, pos: Vec2) => void;
  onRelease: () => void;
}) {
  const { length, width } = pitchDimensions("full");

  function readPoint(event: ThreeEvent<PointerEvent>) {
    const pos = clampPitch(
      worldToPitch({ x: event.point.x, z: event.point.z }, "full"),
    );
    return snap ? snapPitch(pos) : pos;
  }

  return (
    <mesh
      position={[0, 0.19, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(event) => {
        if (!dragTarget) return;
        event.stopPropagation();
        onMove(dragTarget, readPoint(event));
      }}
      onPointerUp={(event) => {
        if (!dragTarget) return;
        event.stopPropagation();
        onRelease();
      }}
      onPointerLeave={() => {
        if (dragTarget) onRelease();
      }}
    >
      <planeGeometry args={[length, width]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

type HeatmapCell = {
  id: string;
  x: number;
  z: number;
  value: number;
};

function HeatmapLayer({ cells }: { cells: HeatmapCell[] }) {
  return (
    <group>
      {cells.map((cell) => (
        <mesh
          key={cell.id}
          position={[cell.x, 0.115, cell.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[8.5, 6.8]} />
          <meshBasicMaterial
            color={cell.value > 0.72 ? "#facc15" : "#38bdf8"}
            transparent
            opacity={0.08 + cell.value * 0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function TransitionTrails({
  players,
  fromShape,
  toShape,
  visible,
}: {
  players: Player[];
  fromShape: Shape;
  toShape: Shape;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <group>
      {Object.entries(fromShape.positions).map(([playerId, from]) => {
        const to = toShape.positions[playerId];
        const player = players.find((item) => item.id === playerId);
        if (!to || !player) return null;
        const a = pitchToWorld(from, "full");
        const b = pitchToWorld(to, "full");
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        const mid = [(a.x + b.x) / 2, 1.02, (a.z + b.z) / 2] as const;

        return (
          <group key={`trail-${playerId}`}>
            <Line
              points={[
                [a.x, 0.72, a.z],
                [b.x, 0.72, b.z],
              ]}
              color="#facc15"
              lineWidth={1.8}
              transparent
              opacity={0.62}
            />
            <Billboard position={mid}>
              <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[2.15, 0.5]} />
                <meshBasicMaterial color="#061018" transparent opacity={0.84} />
              </mesh>
              <Text
                fontSize={0.17}
                color="#facc15"
                anchorX="center"
                anchorY="middle"
              >
                {`${lastName(player.name)} ${distance.toFixed(0)}m`}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function ComparisonGhosts({
  players,
  positions,
}: {
  players: Player[];
  positions: Record<string, Vec2>;
}) {
  return (
    <group>
      {Object.entries(positions).map(([playerId, pos]) => {
        const player = players.find((item) => item.id === playerId);
        if (!player) return null;
        const world = pitchToWorld(pos, "full");

        return (
          <group key={`ghost-${playerId}`} position={[world.x, 0.2, world.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.8, 2.18, 48]} />
              <meshBasicMaterial color="#facc15" transparent opacity={0.55} />
            </mesh>
            <Billboard position={[0, 1.0, 0]}>
              <Text
                fontSize={0.18}
                color="#facc15"
                anchorX="center"
                anchorY="middle"
              >
                {lastName(player.name).toUpperCase()}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function TacticalChip({
  id,
  team,
  num,
  label,
  role,
  pos,
  selected,
  dragging,
  onPointerDown,
}: {
  id: string;
  team: "own" | "rival";
  num: number;
  label: string;
  role: string;
  pos: Vec2;
  selected: boolean;
  dragging: boolean;
  onPointerDown: () => void;
}) {
  const group = useRef<Group>(null);
  const target = useMemo(() => new Vector3(), []);
  const world = pitchToWorld(pos, "full");
  const color = team === "own" ? "#5eead4" : "#ef4444";
  const labelColor = team === "own" ? "#d7fffb" : "#fee2e2";

  useFrame((_state, delta) => {
    if (!group.current) return;
    target.set(world.x, dragging ? 0.72 : 0.28, world.z);
    group.current.position.lerp(target, Math.min(1, delta * 14));
  });

  return (
    <group
      ref={group}
      position={[world.x, dragging ? 0.72 : 0.28, world.z]}
      userData={{ id }}
    >
      <mesh
        castShadow
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown();
        }}
      >
        <cylinderGeometry args={[1.46, 1.58, 0.38, 52]} />
        <meshStandardMaterial
          color={color}
          roughness={0.48}
          metalness={0.06}
          transparent
          opacity={team === "rival" ? 0.78 : 0.96}
        />
      </mesh>
      <mesh position={[0, 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.62, selected ? 2.05 : 1.84, 52]} />
        <meshBasicMaterial
          color={selected ? "#facc15" : color}
          transparent
          opacity={selected ? 0.62 : 0.28}
        />
      </mesh>
      <Text
        position={[0, 0.51, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.82}
        color="#061018"
        anchorX="center"
        anchorY="middle"
      >
        {num}
      </Text>
      <Text
        position={[0, 0.52, 1.0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.23}
        color="#061018"
        anchorX="center"
        anchorY="middle"
      >
        {role}
      </Text>
      <Billboard position={[0, 1.32, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[2.45, 0.48]} />
          <meshBasicMaterial color="#061018" transparent opacity={0.88} />
        </mesh>
        <Text
          position={[0, 0.02, 0]}
          fontSize={0.18}
          color={labelColor}
          anchorX="center"
          anchorY="middle"
          maxWidth={2.2}
        >
          {label.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

function TacticalLines({
  chips,
  metrics,
}: {
  chips: Array<{ player: Player; role: string; pos: Vec2 }>;
  metrics: TacticalMetrics;
}) {
  const groups = groupLinePlayers(chips);
  return (
    <group>
      {Object.entries(groups).map(([name, group]) =>
        group.length >= 2 ? (
          <Line
            key={name}
            points={group.map((chip) => {
              const point = pitchToWorld(chip.pos, "full");
              return [point.x, 0.55, point.z] as [number, number, number];
            })}
            color={
              name === "attack"
                ? "#facc15"
                : name === "mid"
                  ? "#5eead4"
                  : "#93c5fd"
            }
            lineWidth={2}
            transparent
            opacity={0.72}
          />
        ) : null,
      )}
      <mesh
        position={[metrics.center.x, 0.48, metrics.center.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.0, 1.34, 48]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function MetricsMarkers({ metrics }: { metrics: TacticalMetrics }) {
  return (
    <Billboard position={[metrics.center.x, 2.0, metrics.center.z]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[4.8, 0.86]} />
        <meshBasicMaterial color="#061018" transparent opacity={0.86} />
      </mesh>
      <Text fontSize={0.18} color="#f8fafc" anchorX="center" anchorY="middle">
        {`ANCHO ${metrics.width.toFixed(0)}m  |  PROF ${metrics.depth.toFixed(0)}m  |  COMP ${metrics.compactness.toFixed(0)}m`}
      </Text>
    </Billboard>
  );
}

function ShapeMiniMap({ positions }: { positions: Record<string, Vec2> }) {
  return (
    <span className="shape-minimap" aria-hidden>
      {Object.entries(positions).map(([id, pos]) => (
        <i key={id} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} />
      ))}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

type TacticalMetrics = {
  width: number;
  depth: number;
  compactness: number;
  duels: number;
  heatScore: number;
  center: { x: number; z: number };
};

function computeMetrics(
  own: Array<{ player: Player; role: string; pos: Vec2 }>,
  rivals: Array<{ rival: RivalChip; role: string; pos: Vec2 }>,
): TacticalMetrics {
  if (own.length === 0) {
    return {
      width: 0,
      depth: 0,
      compactness: 0,
      duels: 0,
      heatScore: 0,
      center: { x: 0, z: 0 },
    };
  }
  const ownWorld = own.map((chip) => pitchToWorld(chip.pos, "full"));
  const minX = Math.min(...ownWorld.map((point) => point.x));
  const maxX = Math.max(...ownWorld.map((point) => point.x));
  const minZ = Math.min(...ownWorld.map((point) => point.z));
  const maxZ = Math.max(...ownWorld.map((point) => point.z));
  const center = {
    x: ownWorld.reduce((sum, point) => sum + point.x, 0) / ownWorld.length,
    z: ownWorld.reduce((sum, point) => sum + point.z, 0) / ownWorld.length,
  };
  const compactness =
    ownWorld.reduce(
      (sum, point) => sum + Math.hypot(point.x - center.x, point.z - center.z),
      0,
    ) / ownWorld.length;
  const duels = countLikelyDuels(own, rivals);
  const heatmap = computeHeatmapCells(own, rivals);
  const heatScore =
    heatmap.reduce((sum, cell) => sum + cell.value, 0) /
    Math.max(1, heatmap.length);

  return {
    width: maxZ - minZ,
    depth: maxX - minX,
    compactness,
    duels,
    heatScore: heatScore * 100,
    center,
  };
}

function computeHeatmapCells(
  own: Array<{ pos: Vec2 }>,
  rivals: Array<{ pos: Vec2 }>,
): HeatmapCell[] {
  const { length, width } = pitchDimensions("full");
  const all = [...own, ...rivals].map((chip) => pitchToWorld(chip.pos, "full"));
  const cells: HeatmapCell[] = [];

  for (let x = -length / 2 + 12; x <= length / 2 - 12; x += 18) {
    for (let z = -width / 2 + 10; z <= width / 2 - 10; z += 14) {
      const nearest = Math.min(
        ...(all.length
          ? all.map((point) => Math.hypot(point.x - x, point.z - z))
          : [18]),
      );
      const value = Math.max(0, Math.min(1, (nearest - 4) / 14));
      cells.push({ id: `heat-${x}-${z}`, x, z, value });
    }
  }

  return cells;
}

function countLikelyDuels(
  own: Array<{ player: Player; role: string; pos: Vec2 }>,
  rivals: Array<{ rival: RivalChip; role: string; pos: Vec2 }>,
) {
  const pairs = new Set<string>();

  for (const rival of rivals) {
    const rivalWorld = pitchToWorld(rival.pos, "full");
    const nearest = own
      .map((chip) => {
        const ownWorld = pitchToWorld(chip.pos, "full");
        return {
          playerId: chip.player.id,
          distance: Math.hypot(
            ownWorld.x - rivalWorld.x,
            ownWorld.z - rivalWorld.z,
          ),
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest && nearest.distance < 3.8) {
      pairs.add(`${nearest.playerId}-${rival.rival.id}`);
    }
  }

  return pairs.size;
}

function groupLinePlayers(
  chips: Array<{ role: string; pos: Vec2; player: Player }>,
) {
  const grouped = {
    defense: [] as Array<{ role: string; pos: Vec2; player: Player }>,
    mid: [] as Array<{ role: string; pos: Vec2; player: Player }>,
    attack: [] as Array<{ role: string; pos: Vec2; player: Player }>,
  };

  for (const chip of chips) {
    const role = chip.role.toUpperCase();
    if (role === "GK") continue;
    if (role.includes("B") || role.includes("WB")) grouped.defense.push(chip);
    else if (role.includes("ST") || role.includes("W"))
      grouped.attack.push(chip);
    else grouped.mid.push(chip);
  }

  return {
    defense: grouped.defense.sort((a, b) => a.pos.y - b.pos.y),
    mid: grouped.mid.sort((a, b) => a.pos.y - b.pos.y),
    attack: grouped.attack.sort((a, b) => a.pos.y - b.pos.y),
  };
}

function autoAssign(players: Player[], slots: FormationSlot[]) {
  const used = new Set<string>();
  return slots.map((formationSlot) => {
    const exact = players.find(
      (player) =>
        !used.has(player.id) && compatibleRole(player, formationSlot.role),
    );
    const fallback = players.find((player) => !used.has(player.id));
    const selected = exact ?? fallback;
    if (selected) used.add(selected.id);
    return selected?.id ?? "";
  });
}

function preserveOrAutoAssign(
  current: string[],
  players: Player[],
  slots: FormationSlot[],
) {
  const used = new Set<string>();
  return slots.map((slotItem, index) => {
    const currentId = current[index];
    if (
      currentId &&
      players.some((player) => player.id === currentId) &&
      !used.has(currentId)
    ) {
      used.add(currentId);
      return currentId;
    }
    const selected =
      players.find(
        (player) =>
          !used.has(player.id) && compatibleRole(player, slotItem.role),
      ) ?? players.find((player) => !used.has(player.id));
    if (selected) used.add(selected.id);
    return selected?.id ?? "";
  });
}

function positionsFromAssignments(
  assignments: string[],
  slots: FormationSlot[],
): Record<string, Vec2> {
  return Object.fromEntries(
    assignments
      .map((playerId, index) => [
        playerId,
        slots[index]?.pos ?? { x: 50, y: 50 },
      ])
      .filter(([playerId]) => playerId),
  );
}

function compatibleRole(player: Player, role: string) {
  const normalized = normalizeRole(role);
  return player.positions.some(
    (position) =>
      normalizeRole(position) === normalized ||
      compatibleRoleAliases(normalized).includes(position),
  );
}

function normalizeRole(role: string) {
  if (role === "LWB" || role === "RWB") return "WB";
  if (role === "LM") return "LW";
  if (role === "RM") return "RW";
  if (role === "DM") return "CDM";
  if (role === "AM") return "CAM";
  return role;
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

function rivalBasePositions(): Record<string, Vec2> {
  return Object.fromEntries(
    DEFAULT_RIVALS.map((rival, index) => [
      rival.id,
      RIVAL_BASE[index]?.pos ?? { x: 50, y: 50 },
    ]),
  );
}

function defaultShapes(players: Player[]): Shape[] {
  const assigned = autoAssign(players, FORMATIONS["4-3-3"]);
  const base: Record<string, Vec2> = positionsFromAssignments(
    assigned,
    FORMATIONS["4-3-3"],
  );
  return [
    {
      id: "shape-attack",
      name: "4-3-3 ataque",
      phase: "attack",
      positions: base,
      notes: "Shape base ofensivo.",
      createdAt: Date.now(),
    },
    {
      id: "shape-defense",
      name: "4-5-1 defensa",
      phase: "defense",
      positions: Object.fromEntries(
        Object.entries(base).map(([id, pos]) => [
          id,
          { x: Math.max(8, pos.x - 18), y: 50 + (pos.y - 50) * 0.78 },
        ]),
      ),
      notes: "Repliegue a 4-5-1 compacto.",
      createdAt: Date.now(),
    },
  ];
}

function defaultTransitions(shapes: Shape[]): SavedTransition[] {
  const attack = shapes.find((shape) => shape.phase === "attack") ?? shapes[0];
  const defense =
    shapes.find((shape) => shape.phase === "defense") ?? shapes[1];
  if (!attack || !defense || attack.id === defense.id) return [];

  return [
    {
      id: "transition-attack-defense",
      name: "Ataque -> defensa",
      fromShapeId: attack.id,
      fromShapeName: attack.name,
      toShapeId: defense.id,
      toShapeName: defense.name,
      notes: "Transicion base entre shape ofensivo y repliegue.",
      createdAt: Date.now(),
    },
  ];
}

function clonePositions(positions: Record<string, Vec2>): Record<string, Vec2> {
  return Object.fromEntries(
    Object.entries(positions).map(([id, pos]) => [id, { ...pos }]),
  );
}

function cloneShapes(shapes: Shape[]): Shape[] {
  return shapes.map((shape) => ({
    ...shape,
    positions: clonePositions(shape.positions),
  }));
}

function blendPositions(
  a: Record<string, Vec2>,
  b: Record<string, Vec2>,
  value: number,
) {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Object.fromEntries(
    Array.from(ids).map((id) => {
      const from = a[id] ?? b[id] ?? { x: 50, y: 50 };
      const to = b[id] ?? a[id] ?? from;
      return [
        id,
        {
          x: from.x + (to.x - from.x) * value,
          y: from.y + (to.y - from.y) * value,
        },
      ];
    }),
  );
}

function computeTransitionDistances(
  players: Player[],
  from?: Shape,
  to?: Shape,
) {
  if (!from || !to) return [];
  return Object.keys(from.positions)
    .map((playerId) => {
      const start = from.positions[playerId];
      const end = to.positions[playerId];
      const player = players.find((item) => item.id === playerId);
      if (!start || !end || !player) return null;
      const a = pitchToWorld(start, "full");
      const b = pitchToWorld(end, "full");
      return {
        playerId,
        name: lastName(player.name),
        distance: Math.hypot(a.x - b.x, a.z - b.z),
      };
    })
    .filter(
      (entry): entry is { playerId: string; name: string; distance: number } =>
        Boolean(entry),
    )
    .sort((a, b) => b.distance - a.distance);
}

function buildCoachShapeContext({
  formation,
  players,
  ownChips,
  shapes,
  savedTransitions,
  selectedShapeId,
  fromShapeId,
  toShapeId,
  rivalChips,
}: {
  formation: string;
  players: Player[];
  ownChips: Array<{ player: Player; role: string; pos: Vec2 }>;
  shapes: Shape[];
  savedTransitions: SavedTransition[];
  selectedShapeId: string | null;
  fromShapeId: string | null;
  toShapeId: string | null;
  rivalChips: Array<{ rival: RivalChip; role: string; pos: Vec2 }>;
}): CoachShapeContext {
  const selectedShape = shapes.find((shape) => shape.id === selectedShapeId);
  const fromShape = shapes.find((shape) => shape.id === fromShapeId);
  const toShape = shapes.find((shape) => shape.id === toShapeId);

  return {
    formation,
    selectedShapeId,
    selectedShapeName: selectedShape?.name,
    currentBoardSummary: summarizeBoard(
      ownChips.map((chip) => ({
        playerId: chip.player.id,
        name: chip.player.name,
        role: chip.role,
        x: chip.pos.x,
        y: chip.pos.y,
      })),
    ),
    currentBoard: ownChips.map((chip) => ({
      playerId: chip.player.id,
      name: chip.player.name,
      role: chip.role,
      x: roundPos(chip.pos.x),
      y: roundPos(chip.pos.y),
    })),
    transition: {
      fromShapeId,
      fromShapeName: fromShape?.name,
      toShapeId,
      toShapeName: toShape?.name,
    },
    shapes: shapes.map((shape) => {
      const shapePlayers = Object.entries(shape.positions)
        .map(([playerId, pos]) => {
          const player = players.find((item) => item.id === playerId);
          if (!player) return null;
          const currentRole =
            ownChips.find((chip) => chip.player.id === playerId)?.role ??
            player.positions[0] ??
            "CM";

          return {
            playerId,
            name: player.name,
            role: currentRole,
            x: roundPos(pos.x),
            y: roundPos(pos.y),
          };
        })
        .filter((entry): entry is CoachShapePlayer => Boolean(entry));

      return {
        id: shape.id,
        name: shape.name,
        phase: shape.phase,
        notes: shape.notes,
        summary: summarizeBoard(shapePlayers),
        players: shapePlayers,
      };
    }),
    savedTransitions: savedTransitions.map((item) => ({
      id: item.id,
      name: item.name,
      fromShapeId: item.fromShapeId,
      fromShapeName: item.fromShapeName,
      toShapeId: item.toShapeId,
      toShapeName: item.toShapeName,
      notes: item.notes,
    })),
    rivalReference: rivalChips.length
      ? rivalChips.map((chip) => ({
          id: chip.rival.id,
          num: chip.rival.num,
          role: chip.role,
          x: roundPos(chip.pos.x),
          y: roundPos(chip.pos.y),
        }))
      : undefined,
  };
}

function summarizeBoard(players: CoachShapePlayer[]) {
  if (!players.length) return "Sin shape cargado.";

  const sortedByX = [...players].sort((a, b) => a.x - b.x);
  const width = Math.max(...players.map((player) => player.y)) -
    Math.min(...players.map((player) => player.y));
  const depth = Math.max(...players.map((player) => player.x)) -
    Math.min(...players.map((player) => player.x));
  const defense = players.filter((player) => isDefenderRole(player.role));
  const midfield = players.filter((player) => isMidfieldRole(player.role));
  const attack = players.filter((player) => isAttackRole(player.role));
  const defenseLine = averageX(defense);
  const midfieldLine = averageX(midfield);
  const attackLine = averageX(attack);
  const leftWide = players.filter((player) => player.y <= 28).length;
  const rightWide = players.filter((player) => player.y >= 72).length;
  const deepest = sortedByX[0];
  const highest = sortedByX.at(-1);

  return [
    `ancho ${width.toFixed(1)} / profundidad ${depth.toFixed(1)}`,
    defense.length ? `defensa en x ${defenseLine.toFixed(1)}` : "",
    midfield.length ? `medio en x ${midfieldLine.toFixed(1)}` : "",
    attack.length ? `ataque en x ${attackLine.toFixed(1)}` : "",
    `izquierda ocupada ${leftWide}, derecha ocupada ${rightWide}`,
    deepest ? `mas bajo ${lastName(deepest.name)} ${deepest.role}` : "",
    highest ? `mas alto ${lastName(highest.name)} ${highest.role}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function averageX(players: CoachShapePlayer[]) {
  if (!players.length) return 0;
  return players.reduce((sum, player) => sum + player.x, 0) / players.length;
}

function isDefenderRole(role: string) {
  const value = role.toUpperCase();
  return value.includes("CB") || value.includes("LB") || value.includes("RB") ||
    value.includes("WB");
}

function isMidfieldRole(role: string) {
  const value = role.toUpperCase();
  return value.includes("CM") || value.includes("CDM") || value.includes("CAM") ||
    value.includes("DM") || value.includes("AM");
}

function isAttackRole(role: string) {
  const value = role.toUpperCase();
  return value.includes("ST") || value.includes("LW") || value.includes("RW") ||
    value.includes("LM") || value.includes("RM");
}

function roundPos(value: number) {
  return Math.round(value * 10) / 10;
}

function snapPitch(pos: Vec2) {
  return clampPitch({
    x: Math.round(pos.x / 2.5) * 2.5,
    y: Math.round(pos.y / 2.5) * 2.5,
  });
}

function slot(role: string, x: number, y: number): FormationSlot {
  return { role, pos: { x, y } };
}

function labelForPhase(phase: ShapePhase) {
  const labels: Record<ShapePhase, string> = {
    attack: "ataque",
    defense: "defensa",
    transition: "transicion",
    buildup: "salida",
    abp: "ABP",
  };
  return labels[phase];
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}
