// Convierte el FBX de "Animated Human by @Quaternius" (CC0, OpenGameArt) a
// GLB para el visor. Ejecutar con la carpeta descomprimida del asset en
// SOURCE_DIR (no se commitea el FBX/Blend originales, solo el GLB salida).
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
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

const SOURCE_DIR =
  process.argv[2] ??
  "/tmp/cc0asset/extracted/Animated Human by @Quaternius/FBX";
const OUT = process.argv[3] ?? "public/models/quaternius-human.glb";

const buffer = readFileSync(`${SOURCE_DIR}/Animated Human.fbx`);
const arrayBuffer = buffer.buffer.slice(
  buffer.byteOffset,
  buffer.byteOffset + buffer.byteLength,
);

const loader = new FBXLoader();
let group;
try {
  group = loader.parse(arrayBuffer, SOURCE_DIR);
} catch (err) {
  console.error("FBXLoader.parse failed:", err);
  process.exit(1);
}

console.log("animations found:", group.animations.map((a) => a.name));
let meshCount = 0;
let skinnedCount = 0;
group.traverse((o) => {
  if (o.isMesh) meshCount += 1;
  if (o.isSkinnedMesh) skinnedCount += 1;
});
console.log("meshes:", meshCount, "skinned:", skinnedCount);

const exporter = new GLTFExporter();
const output = await new Promise((resolve, reject) => {
  exporter.parse(
    group,
    resolve,
    reject,
    { binary: true, animations: group.animations, onlyVisible: true },
  );
});

writeFileSync(OUT, Buffer.from(output));
console.log("wrote", OUT, Buffer.from(output).length, "bytes");
