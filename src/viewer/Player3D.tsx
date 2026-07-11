import type { Actor } from "@/data";
import { useAppStore } from "@/state/useAppStore";
import { Billboard, Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AnimationMixer,
  type AnimationAction,
  type AnimationClip,
  Box3,
  type Bone,
  type Group,
  type Mesh,
  MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { ZONE_NAMES, applyKitZonePartition } from "./lib/kitZones";

type PlayerProps = {
  actor: Actor;
  position: [number, number, number];
  ballPosition?: [number, number, number];
  color: string;
  scale?: number;
  time?: number;
  moving?: boolean;
  /** Instantes (tiempo de escena) en los que este actor da un pase — dispara el gesto de patada. */
  passStarts?: number[];
};

/* ================= rig con mocap =================
 * Transplant verbatim de docs/design/handoff-visor3d/Visor 3D (modelos).html:
 * clips por regex, blending por pesos con histeresis, cadencia = velocidad
 * real, suavizado exponencial de posicion, giro con zona muerta mirando la
 * pelota en reposo, patada procedural sobre el hueso RightUpLeg.
 *
 * W22-A2 (fixup): swap de Xbot.glb -> quaternius-human.glb. Feedback en vivo
 * del dueno sobre Xbot con kit por zonas ya aplicado: "el cuerpo es de robot
 * aun" — el problema no era el color, era la geometria (Xbot expone
 * paneles/juntas tipo figura de accion). Se probo primero soldier.glb
 * ("Vanguard", ejemplo de three.js/Mixamo) pero tambien se rechazo en vivo
 * ("un espanto... parece todo menos jugador" — postura militar encorvada,
 * musculatura exagerada). quaternius-human.glb es el personaje CC0
 * "Animated Human by @Quaternius" (OpenGameArt), convertido de FBX a GLB
 * con scripts/convert-quaternius-human.mjs: proporciones normales, ~1.6k
 * triangulos (vs 49k de Xbot), y el MISMO patron de huesos (Hips/Spine/
 * LeftArm/RightUpLeg/etc, sin prefijo mixamorig: pero mismos nombres) asi
 * que kitZones.ts y el kickBone no necesitaron cambios — solo hubo que
 * hacer robusta la particion para geometria sin index buffer (comun al
 * convertir desde FBX/OBJ, ver kitZones.ts). Licencia real CC0 verificada,
 * no asumida — ver LICENSE-NOTE.md.
 */
const MODEL_URL = "/models/quaternius-human.glb";
const PLAYER_H = 2.3;

const RUN_ENTER = 3.1;
const RUN_EXIT = 2.3;
const RUN_TO_IDLE = 0.35;
const WALK_ENTER = 0.6;
const WALK_EXIT = 0.3;
const TURN_DEADZONE = 0.35;
const KICK_DURATION = 0.45;
const KICK_AMPLITUDE = 1.15;

function findClip(clips: AnimationClip[], re: RegExp) {
  return clips.find((clip) => re.test(clip.name)) ?? clips[0];
}

type LocomotionMode = "idle" | "walk" | "run";

type PlayerRig = {
  heading: number;
  spdS: number;
  mode: LocomotionMode;
  weights: Record<LocomotionMode, number>;
  kickT: number;
  initialized: boolean;
  prevTime: number;
  frameCount: number;
  pendingMixerDt: number;
};

// W22-A2 mandato 2: jugadores lejos de la camara actualizan el mixer cada
// 2-3 frames en vez de cada frame (el skinning de ~11k tris es el costo
// real, no el draw call). El dt saltado se acumula y se aplica de una vez
// en el frame que si actualiza, para que el reloj de la animacion no se
// atrase — solo se ve mas "a los saltos" a distancia, nunca en pausa/timing.
const MIXER_THROTTLE_NEAR = 40;
const MIXER_THROTTLE_FAR = 70;

export function Player3D({
  actor,
  position,
  ballPosition,
  color,
  scale = 1,
  passStarts,
}: PlayerProps) {
  const root = useRef<Group>(null);
  const modelGroup = useRef<Group>(null);
  const own = actor.team === "own";

  const gltf = useGLTF(MODEL_URL);
  const model = useMemo(() => cloneRig(gltf.scene, own, actor.role), [
    gltf.scene,
    own,
    actor.role,
  ]);
  const rigHeight = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    return Math.max(0.5, box.max.y - box.min.y);
  }, [gltf.scene]);

  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const clips = gltf.animations;
    const map: Record<LocomotionMode, AnimationAction> = {
      idle: mixer.clipAction(findClip(clips, /idle/i)),
      walk: mixer.clipAction(findClip(clips, /walk/i)),
      run: mixer.clipAction(findClip(clips, /run/i)),
    };
    (Object.keys(map) as LocomotionMode[]).forEach((key) => {
      map[key].play();
      map[key].setEffectiveWeight(key === "idle" ? 1 : 0);
    });
    mixer.update(Math.random() * 1.7);
    return map;
  }, [gltf.animations, mixer]);

  const kickBone = useMemo(() => {
    let bone: Bone | null = null;
    model.traverse((o) => {
      if (!bone && (o as Bone).isBone && /RightUpLeg$/i.test(o.name)) {
        bone = o as Bone;
      }
    });
    return bone as Bone | null;
  }, [model]);

  const rig = useRef<PlayerRig>({
    heading: 0,
    spdS: 0,
    mode: "idle",
    weights: { idle: 1, walk: 0, run: 0 },
    kickT: -9,
    initialized: false,
    prevTime: 0,
    frameCount: 0,
    pendingMixerDt: 0,
  }).current;

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const speed = useAppStore.getState().speed || 1;
    const time = useAppStore.getState().time;

    const [tx, , tz] = position;
    // Scrub del timeline (salto grande de tiempo, hacia adelante o atras):
    // snap instantaneo en vez de deslizar por varios frames hacia el target.
    // Un frame normal a 2x avanza <=~0.1s; un seek de scrub salta mucho mas.
    const isScrub = Math.abs(time - rig.prevTime) > 0.3;
    if (!rig.initialized || isScrub) {
      root.current.position.set(tx, 0, tz);
      rig.spdS = 0;
      rig.initialized = true;
    }

    // suavizado exponencial de posicion (README: "1 - Math.exp(-dt*8)")
    const k = 1 - Math.exp(-delta * 8);
    const wdx = (tx - root.current.position.x) * k;
    const wdz = (tz - root.current.position.z) * k;
    root.current.position.x += wdx;
    root.current.position.z += wdz;

    const sdt = delta * speed;
    const spdInst = sdt > 0.0001 ? Math.sqrt(wdx * wdx + wdz * wdz) / sdt : 0;
    rig.spdS += (spdInst - rig.spdS) * Math.min(1, delta * 6);
    const spdS = rig.spdS;

    // histeresis de locomocion: sin parpadeo caminar/correr
    let mode = rig.mode;
    if (mode === "run") mode = spdS < RUN_TO_IDLE ? "idle" : spdS < RUN_EXIT ? "walk" : "run";
    else if (mode === "walk")
      mode = spdS > RUN_ENTER ? "run" : spdS < WALK_EXIT ? "idle" : "walk";
    else mode = spdS > RUN_ENTER ? "run" : spdS > WALK_ENTER ? "walk" : "idle";
    rig.mode = mode;

    // orientacion: hacia el movimiento; quieto, se perfila a la pelota sin vibrar
    let targetHeading = rig.heading;
    let turnK: number;
    if (spdS > 0.5 && (wdx !== 0 || wdz !== 0)) {
      targetHeading = Math.atan2(wdx, wdz);
      turnK = delta * 6;
    } else if (ballPosition) {
      const want = Math.atan2(
        ballPosition[0] - root.current.position.x,
        ballPosition[2] - root.current.position.z,
      );
      const diff = normalizeAngle(want - rig.heading);
      if (Math.abs(diff) > TURN_DEADZONE) targetHeading = want;
      turnK = delta * 2.4;
    } else {
      turnK = delta * 2.4;
    }
    rig.heading = lerpAngle(rig.heading, targetHeading, Math.min(1, turnK));
    root.current.rotation.y = rig.heading;

    const targetWeights: Record<LocomotionMode, number> = {
      idle: mode === "idle" ? 1 : 0,
      walk: mode === "walk" ? 1 : 0,
      run: mode === "run" ? 1 : 0,
    };
    (Object.keys(targetWeights) as LocomotionMode[]).forEach((key) => {
      rig.weights[key] += (targetWeights[key] - rig.weights[key]) * Math.min(1, delta * 7);
      actions[key].setEffectiveWeight(rig.weights[key]);
    });
    // cadencia = velocidad real (mata el patinaje); clamp 0.75-1.5
    actions.run.setEffectiveTimeScale(clamp(spdS / 3.2, 0.75, 1.5) * speed);
    actions.walk.setEffectiveTimeScale(clamp(spdS / 1.4, 0.75, 1.5) * speed);
    actions.idle.setEffectiveTimeScale(speed);

    // throttle de mixer por distancia a camara (mandato 2): el costo real es
    // el skinning, no el draw call, asi que jugadores lejos actualizan el
    // mixer cada 2-3 frames. El dt saltado se acumula (pendingMixerDt) para
    // que el reloj de la animacion no se atrase, solo se vea mas a los
    // saltos a distancia.
    rig.frameCount += 1;
    rig.pendingMixerDt += delta;
    const camDist = state.camera.position.distanceTo(root.current.position);
    const throttleN = camDist > MIXER_THROTTLE_FAR ? 3 : camDist > MIXER_THROTTLE_NEAR ? 2 : 1;
    if (rig.frameCount % throttleN === 0) {
      mixer.update(rig.pendingMixerDt);
      rig.pendingMixerDt = 0;
    }

    if (passStarts && passStarts.length > 0) {
      for (const start of passStarts) {
        if (rig.prevTime <= start && time > start) rig.kickT = 0;
      }
    }
    if (rig.kickT >= 0 && kickBone) {
      rig.kickT += sdt;
      const kp = rig.kickT / KICK_DURATION;
      if (kp <= 1) kickBone.rotation.x -= Math.sin(kp * Math.PI) * KICK_AMPLITUDE;
      else rig.kickT = -9;
    }
    rig.prevTime = time;
  });

  return (
    <group ref={root} scale={scale}>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.86, 40]} />
        <meshBasicMaterial color="#02070a" transparent opacity={0.34} />
      </mesh>
      <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 1.02, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      <group ref={modelGroup} scale={PLAYER_H / rigHeight}>
        <primitive object={model} />
      </group>
      <JerseyBackNumber actor={actor} />
      <PlayerLabel actor={actor} teamColor={color} />
    </group>
  );
}

const SKIN_COLOR = "#e6b887";
const HAIR_COLOR = "#3b2a1a";
const BOOT_COLOR = "#111827";

/**
 * Clona el rig por jugador (SkeletonUtils.clone) y arma el kit de futbol
 * por zonas (W22-A2 mandato 1): particiona la geometria por influencia de
 * hueso dominante UNA vez (compartida entre clones, geometria por
 * referencia) y reemplaza los 2 materiales "panel de robot" del GLB por 6
 * materiales de zona (camiseta/short/media/botin/piel/pelo) tintados por
 * equipo, en vez de tintar los 2 materiales originales.
 */
function cloneRig(source: Object3D, own: boolean, role: string) {
  applyKitZonePartition(source);
  const jerseyColor = own ? (role === "GK" ? "#e8973c" : "#c7df5f") : "#8a2f22";
  const zoneColors: Record<(typeof ZONE_NAMES)[number], string> = {
    jersey: jerseyColor,
    shorts: shadeColor(jerseyColor, -42),
    sock: shadeColor(jerseyColor, 18),
    boot: BOOT_COLOR,
    skin: SKIN_COLOR,
    hair: HAIR_COLOR,
  };
  const zoneMaterials = ZONE_NAMES.map((zone) => {
    const mat = new MeshStandardMaterial({
      color: zoneColors[zone],
      roughness: zone === "skin" ? 0.62 : 0.72,
      metalness: 0.03,
    });
    mat.name = `zone_${zone}`;
    return mat;
  });

  const cloned = clone(source) as Group;
  cloned.traverse((o) => {
    const mesh = o as Mesh | SkinnedMesh;
    if (!("isMesh" in mesh) && !("isSkinnedMesh" in mesh)) return;
    // W22-A2 mandato 2: un skinned mesh de ~11k tris casteando shadow-map
    // significa recalcular el skinning una SEGUNDA vez por frame (pase de
    // profundidad de la luz). El disco oscuro semitransparente bajo cada
    // jugador (mas abajo en el JSX) ya funciona como blob shadow barato —
    // no depende de shadow-map, es geometria plana con meshBasicMaterial.
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    if (mesh.geometry.groups.length > 0) {
      mesh.material = zoneMaterials;
    }
  });
  return cloned;
}

function JerseyBackNumber({ actor }: { actor: Actor }) {
  return (
    <group position={[0, 1.08, -0.18]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[0.42, 0.34]} />
        <meshBasicMaterial color="#061018" transparent opacity={0.48} />
      </mesh>
      <Text
        fontSize={0.24}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineColor="#061018"
        outlineWidth={0.018}
      >
        {actor.num}
      </Text>
    </group>
  );
}

function PlayerLabel({
  actor,
  teamColor,
}: { actor: Actor; teamColor: string }) {
  return (
    <Billboard position={[0, PLAYER_H + 0.75, 0]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[0.82, 0.4]} />
        <meshBasicMaterial color="#061018" transparent opacity={0.84} />
      </mesh>
      <mesh position={[-0.36, 0, 0]}>
        <circleGeometry args={[0.19, 24]} />
        <meshBasicMaterial color={teamColor} />
      </mesh>
      <Text
        position={[-0.36, 0.005, 0.01]}
        fontSize={0.18}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {actor.num}
      </Text>
      <Text
        position={[0.13, 0.005, 0.01]}
        fontSize={0.13}
        color="#d8fffb"
        anchorX="center"
        anchorY="middle"
      >
        {actor.role.toUpperCase()}
      </Text>
    </Billboard>
  );
}

export function SimplePlayer3D({
  actor,
  position,
  angle,
  color,
  scale = 1,
}: PlayerProps & { angle: number }) {
  return (
    <group
      position={position}
      rotation={[0, -angle + Math.PI / 2, 0]}
      scale={scale}
    >
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 28]} />
        <meshBasicMaterial color="#02070a" transparent opacity={0.32} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.42, 0.82, 16]} />
        <meshStandardMaterial color={color} roughness={0.68} metalness={0.03} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#f2c394" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.16, -0.18]} castShadow>
        <boxGeometry args={[0.62, 0.25, 0.34]} />
        <meshStandardMaterial color={shadeColor(color, -42)} roughness={0.7} />
      </mesh>
      <mesh position={[-0.17, -0.18, -0.06]} castShadow>
        <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
        <meshStandardMaterial color={shadeColor(color, 18)} roughness={0.7} />
      </mesh>
      <mesh position={[0.17, -0.18, -0.06]} castShadow>
        <capsuleGeometry args={[0.09, 0.42, 4, 8]} />
        <meshStandardMaterial color={shadeColor(color, 18)} roughness={0.7} />
      </mesh>
      <JerseyBackNumber actor={actor} />
      <PlayerLabel actor={actor} teamColor={color} />
    </group>
  );
}

function normalizeAngle(value: number) {
  let d = value;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function lerpAngle(a: number, b: number, k: number) {
  return a + normalizeAngle(b - a) * k;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shadeColor(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const num = Number.parseInt(value, 16);
  const r = clampColor((num >> 16) + amount);
  const g = clampColor(((num >> 8) & 0x00ff) + amount);
  const b = clampColor((num & 0x0000ff) + amount);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, value));
}

useGLTF.preload(MODEL_URL);
