import { useMemo } from "react";
import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { type PitchMode, pitchDimensions } from "./lib/coords";

type PitchProps = {
  mode: PitchMode;
};

const LINE_COLOR = "#f3f7f2";
const LINE_Y = 0.072;
const TURF_Y = 0;
const MOW_BAND_KEYS = [
  "mow-a",
  "mow-b",
  "mow-c",
  "mow-d",
  "mow-e",
  "mow-f",
  "mow-g",
  "mow-h",
  "mow-i",
  "mow-j",
  "mow-k",
  "mow-l",
];

export function Pitch3D({ mode }: PitchProps) {
  const { length, width } = pitchDimensions(mode);
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const grass = useMemo(
    () => createGrassTextures(length, width),
    [length, width],
  );

  const penaltyDepth = Math.min(16.5, length * 0.32);
  const penaltyWidth = Math.min(40.32, width * 0.62);
  const sixDepth = Math.min(5.5, length * 0.16);
  const sixWidth = Math.min(18.32, width * 0.3);
  const spotDistance = Math.min(11, penaltyDepth * 0.78);
  const centerRadius = Math.min(9.15, width * 0.18);
  const hasStandardMarkings =
    mode === "full" || mode === "half" || mode === "third";
  const isFull = mode === "full";
  const isHalf = mode === "half";
  const isThird = mode === "third";
  const isSmall = mode === "small";

  return (
    <group>
      <mesh receiveShadow position={[0, -0.035, 0]}>
        <boxGeometry args={[length + 5, 0.08, width + 5]} />
        <meshStandardMaterial color="#06130d" roughness={0.92} metalness={0} />
      </mesh>

      <mesh receiveShadow position={[0, TURF_Y, 0]}>
        <boxGeometry args={[length, 0.035, width]} />
        <meshStandardMaterial
          map={grass.diffuse}
          roughnessMap={grass.roughness}
          aoMap={grass.ao}
          bumpMap={grass.bump}
          bumpScale={0.045}
          color="#64a64d"
          roughness={0.88}
          metalness={0.015}
        />
      </mesh>

      <MowingBands length={length} width={width} />

      <FlatLine
        x={0}
        z={-halfWidth}
        length={length}
        width={0.11}
        opacity={0.86}
      />
      <FlatLine
        x={0}
        z={halfWidth}
        length={length}
        width={0.11}
        opacity={0.86}
      />
      <FlatLine
        x={-halfLength}
        z={0}
        length={0.11}
        width={width}
        opacity={0.86}
      />
      <FlatLine
        x={halfLength}
        z={0}
        length={0.11}
        width={width}
        opacity={0.86}
      />

      {isFull ? (
        <FlatLine x={0} z={0} length={0.1} width={width} opacity={0.8} />
      ) : null}
      {isHalf ? (
        <FlatLine
          x={-halfLength}
          z={0}
          length={0.1}
          width={width}
          opacity={0.8}
        />
      ) : null}

      {isSmall ? null : (
        <>
          <BoxMarkings
            side="right"
            halfLength={halfLength}
            depth={penaltyDepth}
            boxWidth={penaltyWidth}
          />
          <BoxMarkings
            side="right"
            halfLength={halfLength}
            depth={sixDepth}
            boxWidth={sixWidth}
          />
        </>
      )}

      {isFull ? (
        <>
          <BoxMarkings
            side="left"
            halfLength={halfLength}
            depth={penaltyDepth}
            boxWidth={penaltyWidth}
          />
          <BoxMarkings
            side="left"
            halfLength={halfLength}
            depth={sixDepth}
            boxWidth={sixWidth}
          />
        </>
      ) : null}

      {isFull || isHalf ? <CircleMarking radius={centerRadius} /> : null}
      {isThird ? (
        <ThirdReferenceLine halfLength={halfLength} width={width} />
      ) : null}

      {hasStandardMarkings ? (
        <>
          <Disc x={0} z={0} radius={0.18} />
          <Disc x={halfLength - spotDistance} z={0} radius={0.16} />
          {isFull ? (
            <Disc x={-halfLength + spotDistance} z={0} radius={0.16} />
          ) : null}
        </>
      ) : null}

      {isSmall ? <SmallGoal x={halfLength + 0.5} /> : null}
      {isSmall ? <SmallGoal x={-halfLength - 0.5} /> : null}

      {isFull || isHalf || isThird ? <Goal x={halfLength + 1.05} /> : null}
      {isFull ? <Goal x={-halfLength - 1.05} /> : null}

      {isFull ? (
        <>
          <CornerFlags halfLength={halfLength} halfWidth={halfWidth} />
          <TechnicalArea x={-8} z={halfWidth + 1.7} />
          <TechnicalArea x={8} z={halfWidth + 1.7} />
        </>
      ) : null}
    </group>
  );
}

function MowingBands({ length, width }: { length: number; width: number }) {
  const count = MOW_BAND_KEYS.length;
  const stripeLength = length / count;

  return (
    <group>
      {MOW_BAND_KEYS.map((key, index) => (
        <mesh
          key={key}
          position={[
            -length / 2 + (index + 0.5) * stripeLength,
            LINE_Y - 0.047,
            0,
          ]}
          receiveShadow
        >
          <boxGeometry args={[stripeLength, 0.012, width]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? "#79b85a" : "#4f9444"}
            transparent
            opacity={index % 2 === 0 ? 0.16 : 0.1}
            roughness={0.96}
            metalness={0}
          />
        </mesh>
      ))}
      <mesh position={[0, LINE_Y - 0.04, 0]} rotation={[0, 0, -0.035]}>
        <boxGeometry args={[length * 1.08, 0.01, width * 0.18]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.028} />
      </mesh>
      <mesh position={[0, LINE_Y - 0.039, 0]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[length * 1.08, 0.01, width * 0.15]} />
        <meshBasicMaterial color="#03170d" transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

function BoxMarkings({
  side,
  halfLength,
  depth,
  boxWidth,
}: {
  side: "left" | "right";
  halfLength: number;
  depth: number;
  boxWidth: number;
}) {
  const innerX = side === "left" ? -halfLength + depth : halfLength - depth;
  const centerX =
    side === "left" ? -halfLength + depth / 2 : halfLength - depth / 2;

  return (
    <group>
      <FlatLine x={innerX} z={0} length={0.1} width={boxWidth} opacity={0.84} />
      <FlatLine
        x={centerX}
        z={boxWidth / 2}
        length={depth}
        width={0.1}
        opacity={0.84}
      />
      <FlatLine
        x={centerX}
        z={-boxWidth / 2}
        length={depth}
        width={0.1}
        opacity={0.84}
      />
    </group>
  );
}

function CircleMarking({ radius }: { radius: number }) {
  return (
    <mesh position={[0, LINE_Y + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.08, radius + 0.08, 128]} />
      <meshBasicMaterial
        color={LINE_COLOR}
        transparent
        opacity={0.86}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function ThirdReferenceLine({
  halfLength,
  width,
}: { halfLength: number; width: number }) {
  return (
    <group>
      <FlatLine
        x={-halfLength / 3}
        z={0}
        length={0.06}
        width={width}
        opacity={0.2}
      />
      <FlatLine
        x={halfLength / 3}
        z={0}
        length={0.06}
        width={width}
        opacity={0.2}
      />
    </group>
  );
}

function Disc({ x, z, radius }: { x: number; z: number; radius: number }) {
  return (
    <mesh position={[x, LINE_Y + 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 28]} />
      <meshBasicMaterial
        color={LINE_COLOR}
        transparent
        opacity={0.92}
        toneMapped={false}
      />
    </mesh>
  );
}

function FlatLine({
  x,
  z,
  length,
  width,
  opacity = 1,
}: {
  x: number;
  z: number;
  length: number;
  width: number;
  opacity?: number;
}) {
  return (
    <mesh position={[x, LINE_Y, z]}>
      <boxGeometry args={[length, 0.026, width]} />
      <meshBasicMaterial
        color={LINE_COLOR}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  );
}

function TechnicalArea({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, LINE_Y + 0.002, z]}>
      <FlatLine x={0} z={-2.5} length={12} width={0.06} opacity={0.34} />
      <FlatLine x={-6} z={0} length={0.06} width={5} opacity={0.34} />
      <FlatLine x={6} z={0} length={0.06} width={5} opacity={0.34} />
      <FlatLine x={0} z={2.5} length={12} width={0.06} opacity={0.34} />
    </group>
  );
}

function CornerFlags({
  halfLength,
  halfWidth,
}: { halfLength: number; halfWidth: number }) {
  const positions: Array<[number, number]> = [
    [-halfLength, -halfWidth],
    [-halfLength, halfWidth],
    [halfLength, -halfWidth],
    [halfLength, halfWidth],
  ];

  return (
    <group>
      {positions.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 1.5, 10]} />
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.35}
              metalness={0.03}
            />
          </mesh>
          <mesh
            position={[0.22 * Math.sign(x || 1), 1.25, 0]}
            rotation={[0, Math.sign(x || 1) > 0 ? 0 : Math.PI, 0]}
          >
            <planeGeometry args={[0.42, 0.28]} />
            <meshStandardMaterial
              color="#facc15"
              side={DoubleSide}
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SmallGoal({ x }: { x: number }) {
  return (
    <group position={[x, 0.35, 0]}>
      <GoalPost x={0} y={0} z={-1.6} height={0.7} />
      <GoalPost x={0} y={0} z={1.6} height={0.7} />
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.12, 0.12, 3.36]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.42} />
      </mesh>
    </group>
  );
}

function Goal({ x }: { x: number }) {
  const depthSign = x > 0 ? 1 : -1;

  return (
    <group position={[x, 0.64, 0]}>
      <GoalPost x={0} y={0} z={-3.66} height={1.28} />
      <GoalPost x={0} y={0} z={3.66} height={1.28} />
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.16, 0.16, 7.48]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.42} />
      </mesh>
      <mesh
        position={[depthSign * 1.1, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[2.2, 7.42]} />
        <meshBasicMaterial
          color="#dbeafe"
          transparent
          opacity={0.11}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function GoalPost({
  x,
  y,
  z,
  height,
}: { x: number; y: number; z: number; height: number }) {
  return (
    <mesh position={[x, y, z]} castShadow>
      <boxGeometry args={[0.16, height, 0.16]} />
      <meshStandardMaterial color="#f8fafc" roughness={0.42} />
    </mesh>
  );
}

function createGrassTextures(length: number, width: number) {
  const diffuse = new CanvasTexture(makeGrassCanvas("diffuse"));
  const roughness = new CanvasTexture(makeGrassCanvas("roughness"));
  const ao = new CanvasTexture(makeGrassCanvas("ao"));
  const bump = new CanvasTexture(makeGrassCanvas("bump"));
  const textures = [diffuse, roughness, ao, bump];

  for (const texture of textures) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(Math.max(3, length / 8), Math.max(3, width / 8));
    texture.anisotropy = 8;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
  }

  diffuse.colorSpace = SRGBColorSpace;

  return { diffuse, roughness, ao, bump };
}

function makeGrassCanvas(kind: "diffuse" | "roughness" | "ao" | "bump") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const fiber =
        noise2d(x * 0.035, y * 0.18) * 0.55 + noise2d(x * 0.2, y * 0.55) * 0.25;
      const blade =
        Math.sin((x + noise2d(x * 0.03, y * 0.03) * 20) * 0.22) * 0.5 + 0.5;
      const value = clamp255(110 + fiber * 42 + blade * 16);

      if (kind === "diffuse") {
        image.data[index] = clamp255(value * 0.48);
        image.data[index + 1] = clamp255(value * 1.05);
        image.data[index + 2] = clamp255(value * 0.42);
      } else if (kind === "roughness") {
        const rough = clamp255(205 + fiber * 30 - blade * 8);
        image.data[index] = rough;
        image.data[index + 1] = rough;
        image.data[index + 2] = rough;
      } else if (kind === "ao") {
        const ambient = clamp255(205 + fiber * 22);
        image.data[index] = ambient;
        image.data[index + 1] = ambient;
        image.data[index + 2] = ambient;
      } else {
        const bumpValue = clamp255(128 + fiber * 36 + blade * 18);
        image.data[index] = bumpValue;
        image.data[index + 1] = bumpValue;
        image.data[index + 2] = bumpValue;
      }
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  return canvas;
}

function noise2d(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n) - 0.5;
}

function clamp255(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
