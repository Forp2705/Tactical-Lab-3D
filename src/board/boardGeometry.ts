import type { SessionBlock } from "@/data";
import type { PointerEvent } from "react";
import { PITCH_H } from "./boardConstants";
import type {
  BoardArrow,
  BoardObject,
  BoardPoint,
  BoardZoneSemantic,
} from "./boardModel";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: BoardPoint, b: BoardPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function scaleY(y: number) {
  return (y / 100) * PITCH_H;
}

export function shortName(name: string) {
  return name.split(" ")[0]?.slice(0, 8) ?? name.slice(0, 8);
}

export function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pizarra"
  );
}

export function endpointPoint(
  endpoint: BoardArrow["from"],
  objects: BoardObject[],
): BoardPoint {
  if (endpoint.kind === "point") return endpoint.point;
  return (
    objects.find((object) => object.id === endpoint.objectId)?.position ?? {
      x: 50,
      y: 50,
    }
  );
}

export function pointFromSvgEvent(
  event: PointerEvent<SVGGElement>,
): BoardPoint {
  const svg = event.currentTarget.ownerSVGElement;
  if (!svg) return { x: 50, y: 50 };
  const rect = svg.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
  };
}

export function layerVisibleForArrow(arrow: BoardArrow, layers: Set<string>) {
  if (arrow.layer === "rival") return true;
  if (arrow.semantic === "pass") return layers.has("attack");
  if (arrow.semantic === "pressure")
    return layers.has("counterPress") || layers.has("defense");
  if (arrow.semantic === "run")
    return layers.has("offensiveTransition") || layers.has("attack");
  return true;
}

export function zoneVisible(semantic: BoardZoneSemantic, layers: Set<string>) {
  if (semantic === "danger") return layers.has("defensiveTransition");
  if (semantic === "press") return layers.has("counterPress");
  if (semantic === "block")
    return layers.has("midBlock") || layers.has("defense");
  return true;
}

export function blockTitle(block?: SessionBlock) {
  return (
    block?.notes?.split("\n")[0]?.replace(/^Problema:\s*/, "") ||
    block?.exerciseId ||
    "Bloque de sesion"
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
