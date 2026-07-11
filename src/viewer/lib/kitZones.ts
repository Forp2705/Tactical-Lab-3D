import type { Object3D, SkinnedMesh } from "three";

/**
 * Particion de una malla skinned (rig mixamorig-style o equivalente) en
 * zonas de kit de futbol, por influencia de hueso dominante (W22-A2,
 * mandato 1: "que sean jugadores, no robots tintados"). Reemplaza los
 * materiales originales del GLB por 6 materiales de zona, sin tocar
 * geometria/topologia ni el rig — solo agrupa triangulos por zona
 * (indexando la geometria si venia sin indice, p.ej. assets convertidos
 * desde FBX/OBJ) y define geometry groups (materialIndex).
 *
 * Corre UNA sola vez por geometria compartida (useGLTF cachea gltf.scene
 * entre instancias; SkeletonUtils.clone comparte la geometria por
 * referencia), guardado por un flag en userData.
 */
export const ZONE_NAMES = [
  "jersey",
  "shorts",
  "sock",
  "boot",
  "skin",
  "hair",
] as const;
export type ZoneName = (typeof ZONE_NAMES)[number];

function boneNameToZone(name: string): ZoneName {
  if (name.includes("ForeArm")) return "skin"; // manga corta: antebrazo a la vista
  if (name.includes("Hand")) return "skin";
  if (name.includes("Shoulder")) return "jersey";
  if (name.includes("Arm")) return "jersey";
  if (name.includes("Spine")) return "jersey";
  if (name.includes("Neck")) return "skin";
  if (name.includes("Head") || name.includes("Eye")) return "skin";
  if (name.includes("Hips")) return "shorts";
  if (name.includes("UpLeg")) return "shorts";
  if (name.includes("Leg")) return "sock";
  if (name.includes("Foot") || name.includes("Toe")) return "boot";
  return "jersey";
}

export function applyKitZonePartition(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    partitionMeshByZone(mesh);
  });
}

function partitionMeshByZone(mesh: SkinnedMesh) {
  const geometry = mesh.geometry;
  if (geometry.userData.__zonesPartitioned) return;
  geometry.userData.__zonesPartitioned = true;

  const bones = mesh.skeleton.bones;
  const boneZones = bones.map((bone) => boneNameToZone(bone.name));

  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const position = geometry.getAttribute("position");
  if (!skinIndex || !skinWeight || !position) return;

  const vertexCount = position.count;
  const vertexZone = new Uint8Array(vertexCount);

  // Zona "head" se subdivide despues en piel/pelo por altura local: guardo
  // el rango Y de los vertices influenciados por Head/HeadTop_End (no
  // Neck/Eye, para que la bbox quede ajustada a la cabeza real).
  let headMinY = Number.POSITIVE_INFINITY;
  let headMaxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < vertexCount; i += 1) {
    const weights = [
      skinWeight.getX(i),
      skinWeight.getY(i),
      skinWeight.getZ(i),
      skinWeight.getW(i),
    ];
    let best = 0;
    for (let k = 1; k < 4; k += 1) if (weights[k] > weights[best]) best = k;
    const jointIndex =
      best === 0
        ? skinIndex.getX(i)
        : best === 1
          ? skinIndex.getY(i)
          : best === 2
            ? skinIndex.getZ(i)
            : skinIndex.getW(i);
    const boneName = bones[jointIndex]?.name ?? "";
    const zone = boneZones[jointIndex] ?? "jersey";
    vertexZone[i] = ZONE_NAMES.indexOf(zone);
    if (boneName.includes("Head") && !boneName.includes("HeadTop")) {
      // el Head "puro" (no HeadTop_End) acota mejor la bbox real del craneo
      const y = position.getY(i);
      if (y < headMinY) headMinY = y;
      if (y > headMaxY) headMaxY = y;
    }
  }

  const skinZoneIdx = ZONE_NAMES.indexOf("skin");
  const hairZoneIdx = ZONE_NAMES.indexOf("hair");
  if (Number.isFinite(headMinY) && headMaxY > headMinY) {
    const threshold = headMinY + (headMaxY - headMinY) * 0.62;
    for (let i = 0; i < vertexCount; i += 1) {
      if (vertexZone[i] !== skinZoneIdx) continue;
      // Solo vertices realmente en la bbox de la cabeza (evita marcar
      // manos/cuello como "pelo" por compartir la zona "skin").
      if (position.getY(i) < headMinY - 0.001 || position.getY(i) > headMaxY + 0.001) {
        continue;
      }
      if (position.getY(i) >= threshold) vertexZone[i] = hairZoneIdx;
    }
  }

  // Geometria no-indexada (comun en assets convertidos desde FBX/OBJ, p.ej.
  // el swap CC0 de Quaternius): cada 3 vertices consecutivos ya son un
  // triangulo, sin buffer de indices. Trato ese caso como un indice
  // identidad (0,1,2,3,...) en vez de perderme el group-by-zone entero.
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : Math.floor(vertexCount / 3);
  const getVertexAt = (t: number, corner: number) =>
    index ? index.getX(t * 3 + corner) : t * 3 + corner;
  const byZone: number[][] = ZONE_NAMES.map(() => []);

  for (let t = 0; t < triCount; t += 1) {
    const a = getVertexAt(t, 0);
    const b = getVertexAt(t, 1);
    const c = getVertexAt(t, 2);
    const votes = [vertexZone[a], vertexZone[b], vertexZone[c]];
    const zone = majorityVote(votes);
    byZone[zone].push(a, b, c);
  }

  const newIndices: number[] = [];
  geometry.clearGroups();
  for (let z = 0; z < ZONE_NAMES.length; z += 1) {
    const start = newIndices.length;
    const tris = byZone[z];
    if (tris.length === 0) continue;
    newIndices.push(...tris);
    geometry.addGroup(start, tris.length, z);
  }
  geometry.setIndex(newIndices);
}

function majorityVote(votes: number[]): number {
  if (votes[0] === votes[1] || votes[0] === votes[2]) return votes[0];
  if (votes[1] === votes[2]) return votes[1];
  return votes[0];
}
