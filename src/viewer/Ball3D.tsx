import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CanvasTexture, type Mesh, SRGBColorSpace, Vector3 } from "three";

type BallProps = {
  position: [number, number, number];
};

export function Ball3D({ position }: BallProps) {
  const mesh = useRef<Mesh>(null);
  const last = useRef(new Vector3(position[0], position[1], position[2]));
  const target = useMemo(() => new Vector3(), []);
  const ballTexture = useMemo(() => createBallTexture(), []);
  const height = Math.max(0, position[1] - 0.16);
  const shadowOpacity = Math.max(0.06, 0.28 - height * 0.16);
  const shadowScale = 1 + height * 0.9;

  useFrame((_state, delta) => {
    if (!mesh.current) return;
    target.set(position[0], position[1], position[2]);
    const current = mesh.current.position;
    const before = current.clone();
    current.lerp(target, Math.min(1, delta * 18));
    const dx = current.x - before.x;
    const dz = current.z - before.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.0001) {
      mesh.current.rotation.z -= dx / 0.32;
      mesh.current.rotation.x += dz / 0.32;
    }
    last.current.copy(current);
  });

  return (
    <group>
      <mesh ref={mesh} castShadow position={position}>
        <sphereGeometry args={[0.32, 64, 64]} />
        <meshStandardMaterial
          map={ballTexture}
          color="#ffffff"
          roughness={0.32}
          metalness={0.015}
        />
      </mesh>
      <mesh
        position={[position[0], 0.015, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[shadowScale, shadowScale, 1]}
      >
        <circleGeometry args={[0.48, 36]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={shadowOpacity}
        />
      </mesh>
    </group>
  );
}

function createBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 9;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const centers = [
    [256, 256, 52],
    [132, 120, 38],
    [376, 114, 38],
    [112, 382, 38],
    [390, 382, 38],
    [255, 78, 32],
    [258, 438, 32],
  ] as const;

  for (const [x, y, r] of centers) {
    polygon(ctx, x, y, r, 5, -Math.PI / 2);
  }

  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(17, 24, 39, 0.72)";
  for (const [x, y] of centers) {
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  const gradient = ctx.createRadialGradient(190, 150, 20, 256, 256, 330);
  gradient.addColorStop(0, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function polygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation = 0,
) {
  ctx.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#111827";
  ctx.fill();
  ctx.stroke();
}
