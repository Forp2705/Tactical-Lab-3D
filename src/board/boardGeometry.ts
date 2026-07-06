import type { SessionBlock } from "@/data";
import type { PointerEvent } from "react";
import { PITCH_H } from "./boardConstants";
import type {
  BoardArrow,
  BoardObject,
  BoardPoint,
  BoardZone,
  BoardZoneSemantic,
} from "./boardModel";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// Edicion de geometria de zona via inspector (W6): el modelo vive en
// normalizado 0-100 (NormalizedCoordSchema) y el schema exige
// x + w <= 100 && y + h <= 100. Editar UN campo a la vez clampeando contra
// los otros tres mantiene ese invariante sin tocar los campos no editados.
// NaN/Infinity (input invalido) -> null, rechazo sobrio sin persistir NaN.
export function zoneGeometryPatch(
  zone: Pick<BoardZone, "x" | "y" | "w" | "h">,
  field: "x" | "y" | "w" | "h",
  rawValue: number,
): Partial<Pick<BoardZone, "x" | "y" | "w" | "h">> | null {
  if (!Number.isFinite(rawValue)) return null;
  switch (field) {
    case "x":
      return { x: clamp(rawValue, 0, 100 - zone.w) };
    case "y":
      return { y: clamp(rawValue, 0, 100 - zone.h) };
    case "w":
      return { w: clamp(rawValue, 1, 100 - zone.x) };
    case "h":
      return { h: clamp(rawValue, 1, 100 - zone.y) };
  }
}

export function distance(a: BoardPoint, b: BoardPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Umbral (unidades normalizadas 0-100) para distinguir un click real de un
// drag intencional al crear zona/bloque. Por debajo, el gesto se trata como
// click simple y conserva el 20x16 centrado preexistente (W8). Elegido bien
// por encima del jitter tipico entre pointerdown/pointerup (<1 unidad) y bien
// por debajo del piso de tamano, para no atrapar drags chicos intencionales.
export const ZONE_DRAG_CLICK_THRESHOLD = 3;

// Piso de w/h para que un drag real pero muy corto (por encima del umbral de
// click) no cree una zona practicamente invisible.
export const ZONE_DRAG_MIN_SIZE = 4;

// Normaliza el rectangulo real de un drag de creacion de zona: las esquinas
// pueden llegar en cualquier orden (arrastre hacia cualquier direccion), se
// aplica un piso de tamano y se clampea contra el invariante del schema
// (x + w <= 100, y + h <= 100 — geometria en 0-100, el render es quien escala).
export function normalizeZoneRect(
  start: BoardPoint,
  end: BoardPoint,
  minSize = ZONE_DRAG_MIN_SIZE,
): { x: number; y: number; w: number; h: number } {
  const x = clamp(Math.min(start.x, end.x), 0, 99);
  const y = clamp(Math.min(start.y, end.y), 0, 99);
  const w = clamp(Math.max(Math.abs(end.x - start.x), minSize), 1, 100 - x);
  const h = clamp(Math.max(Math.abs(end.y - start.y), minSize), 1, 100 - y);
  return { x, y, w, h };
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
