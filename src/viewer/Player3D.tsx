import type { Actor } from "@/data";
import { Billboard, Text, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type AnimationAction,
  type Group,
  type Mesh,
  MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ActorMotion } from "./lib/matchEngine";

type PlayerProps = {
  actor: Actor;
  position: [number, number, number];
  angle: number;
  color: string;
  scale?: number;
  time?: number;
  moving?: boolean;
  motion?: ActorMotion;
};

const MODEL_URL = "/models/footballer.glb";

export function Player3D({
  actor,
  position,
  angle,
  color,
  scale = 1,
  moving = false,
  motion,
}: PlayerProps) {
  const root = useRef<Group>(null);
  const modelGroup = useRef<Group>(null);
  const targetPosition = useMemo(() => new Vector3(), []);
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(
    () => cloneWithUniqueMaterials(gltf.scene),
    [gltf.scene],
  );
  const { actions } = useAnimations(gltf.animations, modelGroup);
  const currentClip = motion ?? (moving ? "Run" : "Idle");

  useEffect(() => {
    tintFootballKit(scene, color);
  }, [scene, color]);

  useEffect(() => {
    playAction(actions, currentClip);
    return () => {
      actions[currentClip]?.fadeOut(1);
    };
  }, [actions, currentClip]);

  useFrame((_state, delta) => {
    if (!root.current) return;
    targetPosition.set(position[0], position[1], position[2]);
    root.current.position.lerp(targetPosition, Math.min(1, delta * 14));
    root.current.rotation.y = dampAngle(
      root.current.rotation.y,
      -angle + Math.PI / 2,
      delta * 12,
    );
  });

  return (
    <group
      ref={root}
      position={position}
      rotation={[0, -angle + Math.PI / 2, 0]}
      scale={scale}
    >
      <mesh
        position={[0, 0.035, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[0.86, 40]} />
        <meshBasicMaterial color="#02070a" transparent opacity={0.34} />
      </mesh>
      <mesh position={[0, 0.038, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 1.02, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>

      <group ref={modelGroup}>
        <primitive object={scene} />
        <JerseyBackNumber actor={actor} />
      </group>
      <PlayerLabel actor={actor} teamColor={color} />
    </group>
  );
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
    <Billboard position={[0, 2.18, 0]}>
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

function playAction(
  actions: Record<string, AnimationAction | null>,
  preferredClip: string,
) {
  const preferred =
    actions[preferredClip] ?? actions[preferredClip.toLowerCase()];
  const fallback =
    actions.Idle ?? actions.idle ?? Object.values(actions).find(Boolean);
  const selected = preferred ?? fallback;
  if (!selected) return;

  for (const action of Object.values(actions)) {
    if (!action || action === selected) continue;
    action.fadeOut(1);
  }

  if (!selected.isRunning()) {
    selected.reset();
  }
  selected.enabled = true;
  selected.fadeIn(1).play();
}

function tintFootballKit(scene: Object3D, color: string) {
  scene.traverse((object) => {
    const mesh = object as Mesh | SkinnedMesh;
    if (!("isMesh" in mesh) && !("isSkinnedMesh" in mesh)) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const material = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    if (!(material instanceof MeshStandardMaterial)) return;

    const name = material.name.toLowerCase();
    if (name.includes("kit_primary")) {
      material.color.set(color);
    } else if (name.includes("kit_shorts")) {
      material.color.set(shadeColor(color, -42));
    } else if (name.includes("kit_socks")) {
      material.color.set(shadeColor(color, 18));
    }
    material.roughness = 0.65;
    material.metalness = 0.05;
  });
}

function cloneWithUniqueMaterials(source: Object3D) {
  const cloned = clone(source) as Group;
  cloned.traverse((object) => {
    const mesh = object as Mesh | SkinnedMesh;
    if (!("isMesh" in mesh) && !("isSkinnedMesh" in mesh)) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
  });
  return cloned;
}

function dampAngle(current: number, target: number, lambda: number) {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * Math.min(1, lambda);
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
