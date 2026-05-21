import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader ??= NodeFileReader;

const root = new THREE.Group();
root.name = "Footballer";

const materials = {
  jersey: material("kit_primary", "#d62828"),
  shorts: material("kit_shorts", "#811717"),
  socks: material("kit_socks", "#e93636"),
  skin: material("skin", "#e6b887"),
  hair: material("hair", "#6b3f24"),
  boots: material("boots", "#111827"),
  sole: material("sole", "#f8fafc"),
};

const hips = new THREE.Group();
hips.name = "Hips";
hips.position.set(0, 0.92, 0);
root.add(hips);

const torso = new THREE.Group();
torso.name = "Torso";
torso.position.set(0, 0.36, 0);
hips.add(torso);
addMesh(torso, "JerseyTorso", new THREE.CapsuleGeometry(0.2, 0.44, 4, 10), materials.jersey, [0, 0, 0]);
addMesh(torso, "ChestPanel", new THREE.BoxGeometry(0.48, 0.42, 0.14), materials.jersey, [0, 0.02, 0.02]);

const head = new THREE.Group();
head.name = "Head";
head.position.set(0, 0.74, 0);
torso.add(head);
addMesh(head, "HeadMesh", new THREE.SphereGeometry(0.17, 14, 14), materials.skin, [0, 0, 0]);
addMesh(head, "HairMesh", new THREE.SphereGeometry(0.176, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), materials.hair, [0, 0.03, 0]);

addArm(torso, "Left", -1);
addArm(torso, "Right", 1);
addLeg(hips, "Left", -1);
addLeg(hips, "Right", 1);

const animations = [
  idleClip(),
  slowWalkClip(),
  walkClip(),
  runClip(),
  sprintClip(),
  defensiveIdleClip(),
  passClip(),
  receiveClip(),
  pressClip(),
  turnClip(),
  kickClip(),
  slideClip(),
  headerClip(),
  celebrateClip(),
];
const exporter = new GLTFExporter();
const output = await new Promise((resolve, reject) => {
  exporter.parse(
    root,
    resolve,
    reject,
    {
      binary: true,
      animations,
      trs: false,
      onlyVisible: true,
    },
  );
});

await writeFile("public/models/footballer.glb", Buffer.from(output));

function material(name, color) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0.02,
  });
  mat.name = name;
  return mat;
}

function addMesh(parent, name, geometry, mat, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function addArm(parent, sideName, side) {
  const upper = new THREE.Group();
  upper.name = `${sideName}UpperArm`;
  upper.position.set(0.27 * side, 0.38, 0.01);
  upper.rotation.z = -0.2 * side;
  parent.add(upper);
  addMesh(upper, `${sideName}Sleeve`, new THREE.CapsuleGeometry(0.055, 0.26, 4, 8), materials.jersey, [0, -0.16, 0]);

  const forearm = new THREE.Group();
  forearm.name = `${sideName}ForeArm`;
  forearm.position.set(0, -0.34, 0);
  upper.add(forearm);
  addMesh(forearm, `${sideName}ForeArmMesh`, new THREE.CapsuleGeometry(0.045, 0.27, 4, 8), materials.skin, [0, -0.15, 0]);

  addMesh(forearm, `${sideName}Hand`, new THREE.SphereGeometry(0.052, 10, 10), materials.skin, [0, -0.31, 0]);
}

function addLeg(parent, sideName, side) {
  const upper = new THREE.Group();
  upper.name = `${sideName}UpperLeg`;
  upper.position.set(0.12 * side, -0.03, 0);
  parent.add(upper);
  addMesh(upper, `${sideName}Short`, new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), materials.shorts, [0, -0.18, 0]);

  const lower = new THREE.Group();
  lower.name = `${sideName}LowerLeg`;
  lower.position.set(0, -0.43, 0);
  upper.add(lower);
  addMesh(lower, `${sideName}Sock`, new THREE.CapsuleGeometry(0.055, 0.4, 4, 8), materials.socks, [0, -0.22, 0]);

  const boot = new THREE.Group();
  boot.name = `${sideName}Boot`;
  boot.position.set(0, -0.47, 0.075);
  lower.add(boot);
  addMesh(boot, `${sideName}BootMesh`, new THREE.BoxGeometry(0.15, 0.08, 0.28), materials.boots, [0, 0, 0]);
  addMesh(boot, `${sideName}BootTip`, new THREE.BoxGeometry(0.11, 0.035, 0.08), materials.sole, [0, -0.02, 0.16]);
}

function idleClip() {
  const times = [0, 0.55, 1.1];
  return new THREE.AnimationClip("Idle", 1.1, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 0.95, 0],
      [0, 0.92, 0],
    ]),
    quatTrack("Torso", times, [
      [0.02, 0, 0],
      [-0.02, 0, 0],
      [0.02, 0, 0],
    ]),
    quatTrack("LeftUpperArm", times, [
      [0.04, 0, 0.18],
      [-0.02, 0, 0.22],
      [0.04, 0, 0.18],
    ]),
    quatTrack("RightUpperArm", times, [
      [-0.02, 0, -0.18],
      [0.04, 0, -0.22],
      [-0.02, 0, -0.18],
    ]),
  ]);
}

function walkClip() {
  const times = [0, 0.5, 1];
  return new THREE.AnimationClip("Walk", 1, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 0.98, 0],
      [0, 0.92, 0],
    ]),
    quatTrack("Torso", times, [
      [0.08, 0, 0.03],
      [0.04, 0, -0.03],
      [0.08, 0, 0.03],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [0.55, 0, -0.04],
      [-0.55, 0, 0.04],
      [0.55, 0, -0.04],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-0.55, 0, 0.04],
      [0.55, 0, -0.04],
      [-0.55, 0, 0.04],
    ]),
    quatTrack("LeftUpperArm", times, [
      [-0.5, 0, 0.24],
      [0.5, 0, 0.16],
      [-0.5, 0, 0.24],
    ]),
    quatTrack("RightUpperArm", times, [
      [0.5, 0, -0.24],
      [-0.5, 0, -0.16],
      [0.5, 0, -0.24],
    ]),
  ]);
}

function runClip() {
  const times = [0, 0.25, 0.5, 0.75, 1];
  return new THREE.AnimationClip("Run", 1, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 1.02, 0],
      [0, 0.92, 0],
      [0, 1.02, 0],
      [0, 0.92, 0],
    ]),
    quatTrack("Torso", times, [
      [0.22, 0, 0.04],
      [0.16, 0, -0.04],
      [0.22, 0, 0.04],
      [0.16, 0, -0.04],
      [0.22, 0, 0.04],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [0.85, 0, -0.06],
      [0.2, 0, 0],
      [-0.85, 0, 0.06],
      [0.2, 0, 0],
      [0.85, 0, -0.06],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-0.85, 0, 0.06],
      [0.2, 0, 0],
      [0.85, 0, -0.06],
      [0.2, 0, 0],
      [-0.85, 0, 0.06],
    ]),
    quatTrack("LeftUpperArm", times, [
      [-0.82, 0, 0.22],
      [0.25, 0, 0.18],
      [0.82, 0, 0.16],
      [0.25, 0, 0.18],
      [-0.82, 0, 0.22],
    ]),
    quatTrack("RightUpperArm", times, [
      [0.82, 0, -0.22],
      [0.25, 0, -0.18],
      [-0.82, 0, -0.16],
      [0.25, 0, -0.18],
      [0.82, 0, -0.22],
    ]),
  ]);
}

function slowWalkClip() {
  const times = [0, 0.8, 1.6];
  return new THREE.AnimationClip("SlowWalk", 1.6, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 0.96, 0],
      [0, 0.92, 0],
    ]),
    quatTrack("Torso", times, [
      [0.04, 0, 0.02],
      [0.02, 0, -0.02],
      [0.04, 0, 0.02],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [0.32, 0, -0.03],
      [-0.32, 0, 0.03],
      [0.32, 0, -0.03],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-0.32, 0, 0.03],
      [0.32, 0, -0.03],
      [-0.32, 0, 0.03],
    ]),
  ]);
}

function sprintClip() {
  const times = [0, 0.18, 0.36, 0.54, 0.72];
  return new THREE.AnimationClip("Sprint", 0.72, [
    positionTrack("Hips", times, [
      [0, 0.9, 0],
      [0, 1.04, 0],
      [0, 0.9, 0],
      [0, 1.04, 0],
      [0, 0.9, 0],
    ]),
    quatTrack("Torso", times, [
      [0.35, 0, 0.05],
      [0.26, 0, -0.05],
      [0.35, 0, 0.05],
      [0.26, 0, -0.05],
      [0.35, 0, 0.05],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [1.05, 0, -0.08],
      [0.12, 0, 0],
      [-1.05, 0, 0.08],
      [0.12, 0, 0],
      [1.05, 0, -0.08],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-1.05, 0, 0.08],
      [0.12, 0, 0],
      [1.05, 0, -0.08],
      [0.12, 0, 0],
      [-1.05, 0, 0.08],
    ]),
    quatTrack("LeftUpperArm", times, [
      [-1.05, 0, 0.28],
      [0.45, 0, 0.18],
      [1.05, 0, 0.1],
      [0.45, 0, 0.18],
      [-1.05, 0, 0.28],
    ]),
    quatTrack("RightUpperArm", times, [
      [1.05, 0, -0.28],
      [0.45, 0, -0.18],
      [-1.05, 0, -0.1],
      [0.45, 0, -0.18],
      [1.05, 0, -0.28],
    ]),
  ]);
}

function defensiveIdleClip() {
  const times = [0, 0.5, 1];
  return new THREE.AnimationClip("DefensiveIdle", 1, [
    positionTrack("Hips", times, [
      [0, 0.84, 0],
      [0, 0.88, 0],
      [0, 0.84, 0],
    ]),
    quatTrack("Torso", times, [
      [0.22, 0, 0.05],
      [0.18, 0, -0.05],
      [0.22, 0, 0.05],
    ]),
    quatTrack("LeftUpperArm", times, [
      [0.1, 0, 0.62],
      [0.06, 0, 0.7],
      [0.1, 0, 0.62],
    ]),
    quatTrack("RightUpperArm", times, [
      [0.06, 0, -0.62],
      [0.1, 0, -0.7],
      [0.06, 0, -0.62],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [0.18, 0, -0.16],
      [0.12, 0, -0.2],
      [0.18, 0, -0.16],
    ]),
    quatTrack("RightUpperLeg", times, [
      [0.12, 0, 0.16],
      [0.18, 0, 0.2],
      [0.12, 0, 0.16],
    ]),
  ]);
}

function passClip() {
  const times = [0, 0.18, 0.42, 0.72];
  return new THREE.AnimationClip("Pass", 0.72, [
    quatTrack("Torso", times, [
      [0.12, 0.08, 0],
      [0.22, -0.08, 0.04],
      [0.12, 0.16, -0.04],
      [0.08, 0, 0],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-0.45, 0, 0.04],
      [0.78, 0, -0.04],
      [-0.2, 0, 0],
      [0, 0, 0],
    ]),
    quatTrack("RightLowerLeg", times, [
      [0, 0, 0],
      [-0.72, 0, 0],
      [0.36, 0, 0],
      [0, 0, 0],
    ]),
    quatTrack("LeftUpperArm", times, [
      [-0.2, 0, 0.55],
      [0.15, 0, 0.72],
      [0.2, 0, 0.45],
      [0, 0, 0.18],
    ]),
  ]);
}

function receiveClip() {
  const times = [0, 0.2, 0.55, 0.85];
  return new THREE.AnimationClip("Receive", 0.85, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 0.86, 0],
      [0, 0.9, 0],
      [0, 0.92, 0],
    ]),
    quatTrack("Torso", times, [
      [0.08, 0, 0],
      [0.24, 0, 0],
      [0.12, 0, 0],
      [0.02, 0, 0],
    ]),
    quatTrack("RightUpperLeg", times, [
      [0.12, 0, 0],
      [0.38, 0, -0.06],
      [0.18, 0, -0.03],
      [0, 0, 0],
    ]),
    quatTrack("RightLowerLeg", times, [
      [0, 0, 0],
      [-0.34, 0, 0],
      [-0.18, 0, 0],
      [0, 0, 0],
    ]),
  ]);
}

function pressClip() {
  const times = [0, 0.22, 0.44, 0.66, 0.88];
  return new THREE.AnimationClip("Press", 0.88, [
    positionTrack("Hips", times, [
      [0, 0.86, 0],
      [0, 0.96, 0],
      [0, 0.86, 0],
      [0, 0.96, 0],
      [0, 0.86, 0],
    ]),
    quatTrack("Torso", times, [
      [0.32, 0, 0.1],
      [0.22, 0, -0.1],
      [0.32, 0, 0.1],
      [0.22, 0, -0.1],
      [0.32, 0, 0.1],
    ]),
    quatTrack("LeftUpperArm", times, [
      [-0.6, 0, 0.52],
      [0.45, 0, 0.38],
      [0.75, 0, 0.18],
      [0.2, 0, 0.38],
      [-0.6, 0, 0.52],
    ]),
    quatTrack("RightUpperArm", times, [
      [0.75, 0, -0.18],
      [0.2, 0, -0.38],
      [-0.6, 0, -0.52],
      [0.45, 0, -0.38],
      [0.75, 0, -0.18],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [0.72, 0, -0.12],
      [-0.42, 0, 0.08],
      [0.72, 0, -0.12],
      [-0.42, 0, 0.08],
      [0.72, 0, -0.12],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-0.42, 0, 0.08],
      [0.72, 0, -0.12],
      [-0.42, 0, 0.08],
      [0.72, 0, -0.12],
      [-0.42, 0, 0.08],
    ]),
  ]);
}

function turnClip() {
  const times = [0, 0.35, 0.7];
  return new THREE.AnimationClip("Turn", 0.7, [
    quatTrack("Hips", times, [
      [0, -0.55, 0],
      [0, 0.48, 0],
      [0, 0, 0],
    ]),
    quatTrack("Torso", times, [
      [0.12, 0.45, 0],
      [0.12, -0.35, 0],
      [0.05, 0, 0],
    ]),
  ]);
}

function kickClip() {
  const times = [0, 0.16, 0.36, 0.7];
  return new THREE.AnimationClip("Kick", 0.7, [
    quatTrack("Torso", times, [
      [0.16, 0.12, 0],
      [0.32, -0.08, 0.06],
      [0.08, 0.18, -0.08],
      [0.04, 0, 0],
    ]),
    quatTrack("RightUpperLeg", times, [
      [-0.72, 0, 0],
      [1.08, 0, -0.08],
      [0.28, 0, 0],
      [0, 0, 0],
    ]),
    quatTrack("RightLowerLeg", times, [
      [0.18, 0, 0],
      [-0.95, 0, 0],
      [0.42, 0, 0],
      [0, 0, 0],
    ]),
  ]);
}

function slideClip() {
  const times = [0, 0.32, 0.72, 1.05];
  return new THREE.AnimationClip("Slide", 1.05, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 0.42, 0.1],
      [0, 0.34, 0.28],
      [0, 0.74, 0],
    ]),
    quatTrack("Torso", times, [
      [0.2, 0, 0],
      [0.95, 0, -0.12],
      [1.15, 0, -0.18],
      [0.3, 0, 0],
    ]),
    quatTrack("LeftUpperLeg", times, [
      [0.2, 0, 0],
      [1.25, 0, -0.18],
      [1.45, 0, -0.18],
      [0.2, 0, 0],
    ]),
    quatTrack("RightUpperLeg", times, [
      [0.1, 0, 0],
      [-0.35, 0, 0.22],
      [-0.42, 0, 0.25],
      [0.1, 0, 0],
    ]),
  ]);
}

function headerClip() {
  const times = [0, 0.22, 0.48, 0.78];
  return new THREE.AnimationClip("Header", 0.78, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 1.18, 0],
      [0, 1.0, 0],
      [0, 0.92, 0],
    ]),
    quatTrack("Torso", times, [
      [0.08, 0, 0],
      [-0.18, 0, 0],
      [0.42, 0, 0],
      [0.04, 0, 0],
    ]),
    quatTrack("Head", times, [
      [0, 0, 0],
      [-0.28, 0, 0],
      [0.38, 0, 0],
      [0, 0, 0],
    ]),
  ]);
}

function celebrateClip() {
  const times = [0, 0.4, 0.8, 1.2];
  return new THREE.AnimationClip("Celebrate", 1.2, [
    positionTrack("Hips", times, [
      [0, 0.92, 0],
      [0, 1.08, 0],
      [0, 0.92, 0],
      [0, 1.02, 0],
    ]),
    quatTrack("LeftUpperArm", times, [
      [-0.2, 0, 0.2],
      [-1.45, 0, 0.45],
      [-1.2, 0, 0.65],
      [-1.45, 0, 0.45],
    ]),
    quatTrack("RightUpperArm", times, [
      [-0.2, 0, -0.2],
      [-1.45, 0, -0.45],
      [-1.2, 0, -0.65],
      [-1.45, 0, -0.45],
    ]),
  ]);
}

function positionTrack(nodeName, times, positions) {
  return new THREE.VectorKeyframeTrack(
    `${nodeName}.position`,
    times,
    positions.flat(),
  );
}

function quatTrack(nodeName, times, rotations) {
  return new THREE.QuaternionKeyframeTrack(
    `${nodeName}.quaternion`,
    times,
    rotations.flatMap((rotation) => {
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
      return [quat.x, quat.y, quat.z, quat.w];
    }),
  );
}
