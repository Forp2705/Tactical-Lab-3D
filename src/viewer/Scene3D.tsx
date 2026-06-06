import type { Actor, Exercise, Layer } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import {
  Billboard,
  ContactShadows,
  OrthographicCamera,
  PerspectiveCamera,
  Text,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  SMAA,
  SSAO,
  Vignette,
} from "@react-three/postprocessing";
import { useEffect, useMemo } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace, Vector3 } from "three";
import { Ball3D } from "./Ball3D";
import { OverlayLayer } from "./Overlays";
import { Pitch3D } from "./Pitch3D";
import { Player3D, SimplePlayer3D } from "./Player3D";
import { type PitchMode, pitchDimensions } from "./lib/coords";
import {
  type EngineActorPose,
  type EngineBallPose,
  type MatchFrame,
  getMatchFrame,
} from "./lib/matchEngine";
import {
  getVisibleOverlays,
  getVisibleZones,
  worldFromPitch,
} from "./lib/runtime";

type SceneProps = {
  exercise: Exercise;
  time: number;
  cameraMode: "top" | "iso" | "broadcast";
  quality?: "high" | "medium" | "low";
  showZones: boolean;
  showRuns: boolean;
  showPasses: boolean;
  showPress: boolean;
  layers: Record<Layer, boolean>;
  personalSpace?: boolean;
};

export function Scene3D({
  exercise,
  time,
  cameraMode,
  quality = "medium",
  showZones,
  showRuns,
  showPasses,
  showPress,
  layers,
  personalSpace = false,
}: SceneProps) {
  const mode = exercise.scene.pitchMode;
  const layerState = useMemo(
    () => ({
      ...layers,
      press: layers.press && showPress,
      notes: layers.notes && showZones,
    }),
    [layers, showPress, showZones],
  );
  const overlays = getVisibleOverlays(exercise, time, layerState).filter(
    (overlay) => {
      if (overlay.type === "run" && !showRuns) return false;
      if (overlay.type === "pass" && !showPasses) return false;
      if (overlay.type === "press" && !showPress) return false;
      return true;
    },
  );
  const zones = showZones ? getVisibleZones(exercise, time, layerState) : [];
  const frame = useMemo(
    () => getMatchFrame(exercise, time, { personalSpace }),
    [exercise, time, personalSpace],
  );
  const topFocus = useMemo(() => getTopFocus(frame, mode), [frame, mode]);
  const actionFocus = useMemo(
    () => ({ x: topFocus.x, z: topFocus.z }),
    [topFocus.x, topFocus.z],
  );
  const useSimplifiedActors = cameraMode !== "top" && frame.actors.length > 14;
  const renderSettings = renderSettingsForQuality(quality);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, renderSettings.dprMax]}
      camera={{ position: [0, 36, 46], fov: 30 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
        gl.outputColorSpace = SRGBColorSpace;
      }}
    >
      <PlaybackDriver duration={exercise.scene.duration} />
      <color attach="background" args={["#07131d"]} />
      <fog attach="fog" args={["#07131d", 115, 240]} />
      <SceneCamera
        cameraMode={cameraMode}
        mode={mode}
        topFocus={topFocus}
        actionFocus={actionFocus}
      />
      <hemisphereLight
        intensity={0.92}
        color="#dff4ff"
        groundColor="#214c2d"
      />
      <ambientLight intensity={0.42} color="#f4fbff" />
      <directionalLight
        position={[18, 38, 14]}
        intensity={1.58}
        castShadow={renderSettings.shadows}
        shadow-mapSize-width={renderSettings.shadowMapSize}
        shadow-mapSize-height={renderSettings.shadowMapSize}
        shadow-radius={renderSettings.shadowRadius}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-24, 28, -16]} intensity={0.3} color="#8dd6ff" />
      <Pitch3D mode={mode} />
      {renderSettings.contactShadows ? (
        <ContactShadows
          position={[0, 0.08, 0]}
          opacity={0.4}
          blur={2.6}
          far={10}
          resolution={renderSettings.contactShadowResolution}
          scale={140}
        />
      ) : null}
      {zones.map((zone) => {
        const a = worldFromPitch({ x: zone.rect.x, y: zone.rect.y }, mode);
        const b = worldFromPitch(
          { x: zone.rect.x + zone.rect.w, y: zone.rect.y + zone.rect.h },
          mode,
        );
        const width = Math.abs(b[0] - a[0]);
        const depth = Math.abs(b[2] - a[2]);
        return (
          <group
            key={zone.id}
            position={[(a[0] + b[0]) / 2, 0.08, (a[2] + b[2]) / 2]}
          >
            <mesh>
              <boxGeometry args={[width, 0.08, depth]} />
              <meshStandardMaterial
                color={zone.color}
                transparent
                opacity={0.18}
              />
            </mesh>
          </group>
        );
      })}
      <OverlayLayer overlays={overlays} mode={mode} frame={frame} />
      {frame.triggers.map((trigger) =>
        trigger.visualMarker ? (
          <TriggerMarker
            key={trigger.id}
            label={trigger.description}
            icon={trigger.visualMarker.icon}
            position={worldFromPitch(trigger.visualMarker.pos, mode)}
          />
        ) : null,
      )}
      {frame.actors.map((pose) =>
        cameraMode === "top" ? (
          <TopActorNode key={pose.actor.id} pose={pose} mode={mode} />
        ) : (
          <ActorNode
            key={pose.actor.id}
            pose={pose}
            time={time}
            mode={mode}
            simplified={useSimplifiedActors}
          />
        ),
      )}
      <BallNode pose={frame.ball} mode={mode} top={cameraMode === "top"} />
      {renderSettings.postprocessing ? (
        <PostProcessingStack settings={renderSettings} />
      ) : null}
    </Canvas>
  );
}

function PostProcessingStack({
  settings,
}: { settings: ReturnType<typeof renderSettingsForQuality> }) {
  if (!settings.ssao) {
    return (
      <EffectComposer multisampling={0}>
        <Vignette offset={0.18} darkness={0.4} />
        <SMAA />
      </EffectComposer>
    );
  }

  if (!settings.bloom) {
    return (
      <EffectComposer multisampling={0}>
        <SSAO
          intensity={settings.ssaoIntensity}
          radius={settings.ssaoRadius}
          luminanceInfluence={0.35}
          worldDistanceThreshold={1}
          worldDistanceFalloff={1}
          worldProximityThreshold={1}
          worldProximityFalloff={1}
        />
        <Vignette offset={0.18} darkness={0.4} />
        <SMAA />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <SSAO
        intensity={settings.ssaoIntensity}
        radius={settings.ssaoRadius}
        luminanceInfluence={0.35}
        worldDistanceThreshold={1}
        worldDistanceFalloff={1}
        worldProximityThreshold={1}
        worldProximityFalloff={1}
      />
      <Bloom
        intensity={0.35}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.25}
      />
      <Vignette offset={0.18} darkness={0.4} />
      <SMAA />
    </EffectComposer>
  );
}

function renderSettingsForQuality(quality: "high" | "medium" | "low") {
  if (quality === "high") {
    return {
      shadows: true,
      shadowMapSize: 4096,
      shadowRadius: 6,
      dprMax: 2,
      environment: true,
      contactShadows: true,
      contactShadowResolution: 1024,
      postprocessing: true,
      ssao: true,
      ssaoIntensity: 20,
      ssaoRadius: 4,
      bloom: true,
    };
  }

  if (quality === "low") {
    return {
      shadows: false,
      shadowMapSize: 1024,
      shadowRadius: 2,
      dprMax: 1.1,
      environment: false,
      contactShadows: false,
      contactShadowResolution: 256,
      postprocessing: false,
      ssao: false,
      ssaoIntensity: 0,
      ssaoRadius: 0,
      bloom: false,
    };
  }

  return {
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 4,
    dprMax: 1.5,
    environment: true,
    contactShadows: true,
    contactShadowResolution: 512,
    postprocessing: true,
    ssao: true,
    ssaoIntensity: 12,
    ssaoRadius: 3,
    bloom: false,
  };
}

function PlaybackDriver({ duration }: { duration: number }) {
  useFrame((_state, delta) => {
    const state = useAppStore.getState();
    if (state.view !== "viewer" || !state.playing) return;

    const next = state.time + delta * state.speed;
    if (next >= duration) {
      state.setTime(0);
      if (state.playing) state.togglePlaying();
      return;
    }

    state.setTime(next);
  });

  return null;
}

function TriggerMarker({
  label,
  icon,
  position,
}: {
  label: string;
  icon: string;
  position: readonly [number, 0, number];
}) {
  return (
    <Billboard position={[position[0], 2.15, position[2]]}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[3.2, 0.92]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.92} />
      </mesh>
      <Text
        position={[-1.25, 0, 0]}
        fontSize={0.38}
        color="#facc15"
        anchorX="center"
        anchorY="middle"
      >
        {icon || "!"}
      </Text>
      <Text
        position={[0.25, 0, 0]}
        fontSize={0.2}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.25}
      >
        {label.toUpperCase()}
      </Text>
    </Billboard>
  );
}

function SceneCamera({
  cameraMode,
  mode,
  topFocus,
  actionFocus,
}: {
  cameraMode: "top" | "iso" | "broadcast";
  mode: PitchMode;
  topFocus: TopFocus;
  actionFocus: { x: number; z: number };
}) {
  const { camera } = useThree();
  const lookTarget = useMemo(() => new Vector3(), []);
  const nextPosition = useMemo(() => new Vector3(), []);
  const preset = useMemo(
    () => cameraPreset(mode, cameraMode),
    [cameraMode, mode],
  );
  useEffect(() => {
    if (cameraMode === "top") return;

    camera.position.set(
      preset.position[0],
      preset.position[1],
      preset.position[2],
    );
    camera.lookAt(0, 0, 0);
  }, [camera, cameraMode, preset]);

  useFrame((_state, delta) => {
    if (cameraMode === "top") {
      camera.position.set(topFocus.x, preset.position[1], topFocus.z + 0.01);
      camera.rotation.set(-Math.PI / 2, 0, 0);
      if ("zoom" in camera) {
        camera.zoom = topFocus.zoom;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const focusOffset = cameraFocusOffset(actionFocus, cameraMode, mode);
    nextPosition.set(
      preset.position[0] + focusOffset.x,
      preset.position[1],
      preset.position[2] + focusOffset.z,
    );
    camera.position.lerp(nextPosition, Math.min(1, delta * 2.2));
    lookTarget.lerp(
      new Vector3(focusOffset.x * 0.9, 0, focusOffset.z * 0.82),
      Math.min(1, delta * 3),
    );
    camera.lookAt(lookTarget);
  });

  if (cameraMode === "top") {
    return (
      <OrthographicCamera
        makeDefault
        position={[topFocus.x, preset.position[1], topFocus.z + 0.01]}
        zoom={topFocus.zoom}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    );
  }

  return (
    <PerspectiveCamera
      makeDefault
      position={preset.position}
      fov={preset.fov}
    />
  );
}

function ActorNode({
  pose,
  time,
  mode,
  simplified,
}: {
  pose: EngineActorPose;
  time: number;
  mode: PitchMode;
  simplified: boolean;
}) {
  const position = worldFromPitch(pose.pos, mode);
  const teamColor = teamColorFor(pose.actor.team);
  if (simplified) {
    return (
      <SimplePlayer3D
        actor={pose.actor}
        position={[position[0], 0, position[2]]}
        angle={pose.direction}
        color={teamColor}
        scale={playerScale(mode)}
        time={time}
        moving={pose.moving}
        motion={pose.motion}
      />
    );
  }

  return (
    <Player3D
      actor={pose.actor}
      position={[position[0], 0, position[2]]}
      angle={pose.direction}
      color={teamColor}
      scale={playerScale(mode)}
      time={time}
      moving={pose.moving}
      motion={pose.motion}
    />
  );
}

function TopActorNode({
  pose,
  mode,
}: { pose: EngineActorPose; mode: PitchMode }) {
  const position = worldFromPitch(pose.pos, mode);
  const teamColor = teamColorFor(pose.actor.team);

  return (
    <TopActorMarker
      actor={pose.actor}
      position={[position[0], 0, position[2]]}
      color={teamColor}
    />
  );
}

function TopActorMarker({
  actor,
  position,
  color,
}: { actor: Actor; position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.68, 42]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.7, 1.95, 42]} />
        <meshBasicMaterial color="#061018" transparent opacity={0.78} />
      </mesh>
      <Billboard position={[0, 1.75, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[2.65, 1.15]} />
          <meshBasicMaterial color="#061018" transparent opacity={0.9} />
        </mesh>
        <Text
          position={[0, 0.2, 0]}
          fontSize={0.58}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
        >
          {actor.num}
        </Text>
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.26}
          color="#7ddfd7"
          anchorX="center"
          anchorY="middle"
        >
          {actor.role.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

function BallNode({
  pose,
  mode,
  top,
}: { pose: EngineBallPose; mode: PitchMode; top: boolean }) {
  const position = worldFromPitch({ x: pose.pos.x, y: pose.pos.y }, mode);
  if (top) {
    return <TopBallMarker position={[position[0], 0, position[2]]} />;
  }
  return (
    <Ball3D position={[position[0], pose.pos.z * 0.55 + 0.13, position[2]]} />
  );
}

function TopBallMarker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 36]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.98, 1.26, 40]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.245, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.32, 1.42, 40]} />
        <meshBasicMaterial color="#061018" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function cameraPreset(
  mode: PitchMode,
  cameraMode: "top" | "iso" | "broadcast",
) {
  const { length } = pitchDimensions(mode);
  const scale = length / 105;

  if (cameraMode === "top") {
    return {
      position: [0, 64 * scale + 18, 0.01] as [number, number, number],
      zoom: 7.4,
      fov: 22,
    };
  }

  if (cameraMode === "broadcast") {
    return {
      position: [0, 27 * scale + 11, 48 * scale + 19] as [
        number,
        number,
        number,
      ],
      zoom: 1,
      fov: 19,
    };
  }

  return {
    position: [16 * scale + 7, 34 * scale + 11, 44 * scale + 10] as [
      number,
      number,
      number,
    ],
    zoom: 1,
    fov: 20,
  };
}

function playerScale(mode: PitchMode) {
  if (mode === "small") return 1.14;
  if (mode === "third") return 1.08;
  return 1.02;
}

type TopFocus = {
  x: number;
  z: number;
  zoom: number;
};

function getTopFocus(frame: MatchFrame, mode: PitchMode): TopFocus {
  const points = frame.actors.map((pose) => {
    const world = worldFromPitch(pose.pos, mode);
    return { x: world[0], z: world[2] };
  });
  const ballWorld = worldFromPitch(
    { x: frame.ball.pos.x, y: frame.ball.pos.y },
    mode,
  );
  points.push({ x: ballWorld[0], z: ballWorld[2] });

  if (points.length === 0) return { x: 0, z: 0, zoom: 7.4 };

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const desiredHeight = Math.max(spanZ + 20, (spanX + 24) / 1.9, 38);
  const zoom = Math.max(8.9, Math.min(15.8, 660 / desiredHeight));

  return {
    x: clamp((minX + maxX) / 2, -34, 34),
    z: clamp((minZ + maxZ) / 2, -22, 22),
    zoom,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cameraFocusOffset(
  focus: { x: number; z: number },
  cameraMode: "top" | "iso" | "broadcast",
  mode: PitchMode,
) {
  const { width } = pitchDimensions(mode);
  const lateralClamp = width * 0.18;

  if (cameraMode === "broadcast") {
    return {
      x: clamp(focus.x * 0.5, -18, 18),
      z: clamp(focus.z * 0.2, -lateralClamp, lateralClamp),
    };
  }

  return {
    x: clamp(focus.x * 0.38, -14, 14),
    z: clamp(focus.z * 0.34, -lateralClamp, lateralClamp),
  };
}

function teamColorFor(team: Actor["team"]) {
  if (team === "own") return "#38bdf8";
  if (team === "rival") return "#ef4444";
  return "#e5e7eb";
}
