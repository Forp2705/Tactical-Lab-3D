import { PITCH_H, PITCH_W } from "@/board/boardConstants";
import { arrowStyle } from "@/board/boardActionStyle";
import {
  buildPlaybackTimeline,
  type PlaybackSegment,
} from "@/board/boardPlayback";
import type { BoardArrowSemantic, BoardPoint, BoardScene } from "@/board/boardModel";

/**
 * Capa de presentacion "broadcast" del Estudio Tactico (W27), portada del
 * prototipo descartable `src/board/proto/playFx.ts` (proto/w26a-vestuario
 * @b3dd56e) a produccion sin cambios de logica. boardPlayback.ts NO se toca:
 * esto solo lee su timeline (from/to/kind/objectIds ya resueltos, estaticos
 * por tramo) y agrega geometria/coreografia de PRESENTACION encima — bezier,
 * foco, camara. Todo es funcion pura de (scene, tSeconds): mismo scene,
 * misma coreografia, cero random por frame.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// Misma curva de aceleracion que boardPlayback.ts (no exportada de ahi
// deliberadamente — es de 3 lineas, replicarla no es "tocar el motor").
export function easeInOutQuad(t: number): number {
  const clamped = clamp01(t);
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - (-2 * clamped + 2) ** 2 / 2;
}

function lerpPoint(from: BoardPoint, to: BoardPoint, eased: number): BoardPoint {
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}

// Firma deterministica del id (nunca random) para decidir de que lado
// "comba" cada flecha curva — mismo scene, mismo lado, siempre.
function seededSign(id: string): 1 | -1 {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return (hash & 1) === 0 ? 1 : -1;
}

// El modelo vive en 0-100 x, 0-100 y; el render escala y por PITCH_H/100
// (scaleY en boardGeometry.ts). Corregimos por ese aspecto para que la comba
// se vea circular en pantalla, no elipsoide.
const ASPECT_Y = PITCH_H / PITCH_W;

export function curveControlPoint(
  from: BoardPoint,
  to: BoardPoint,
  seedId: string,
  magnitudeFrac = 0.15,
): BoardPoint {
  const dxVisual = to.x - from.x;
  const dyVisual = (to.y - from.y) * ASPECT_Y;
  const lenVisual = Math.hypot(dxVisual, dyVisual) || 1;
  const perpXVisual = -dyVisual / lenVisual;
  const perpYVisual = dxVisual / lenVisual;
  const distNormalized = Math.hypot(to.x - from.x, to.y - from.y);
  const offset = distNormalized * magnitudeFrac * seededSign(seedId);
  const midXVisual = (from.x + to.x) / 2 + perpXVisual * offset;
  const midYVisual = ((from.y + to.y) / 2) * ASPECT_Y + perpYVisual * offset;
  return { x: midXVisual, y: midYVisual / ASPECT_Y };
}

export function quadraticBezierPoint(
  p0: BoardPoint,
  control: BoardPoint,
  p2: BoardPoint,
  t: number,
): BoardPoint {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * control.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * control.y + t * t * p2.y,
  };
}

export type FxSegment = PlaybackSegment & {
  semantic: BoardArrowSemantic;
  curved: boolean;
  control: BoardPoint;
};

export type FxTimeline = {
  segments: FxSegment[];
  duration: number;
};

export function buildFxTimeline(scene: BoardScene): FxTimeline {
  const timeline = buildPlaybackTimeline(scene);
  const semanticById = new Map(scene.arrows.map((arrow) => [arrow.id, arrow.semantic]));
  const segments: FxSegment[] = timeline.segments.map((segment) => {
    const semantic = semanticById.get(segment.arrowId) ?? "pass";
    const curved = arrowStyle(semantic).curved;
    const control = curved
      ? curveControlPoint(segment.from, segment.to, segment.arrowId)
      : lerpPoint(segment.from, segment.to, 0.5);
    return { ...segment, semantic, curved, control };
  });
  return { segments, duration: timeline.duration };
}

// Progreso 0..1 crudo del tramo a t (mismo numero que
// useBoardActions().playbackArrowProgress expone) — util cuando se sampleaN
// tiempos pasados (estela/cometa) fuera del hook.
export function segmentRawProgress(segment: FxSegment, tSeconds: number): number {
  if (segment.end === segment.start) return 1;
  return clamp01((tSeconds - segment.start) / (segment.end - segment.start));
}

export function fxPositionAt(segment: FxSegment, tSeconds: number): BoardPoint {
  const eased = easeInOutQuad(segmentRawProgress(segment, tSeconds));
  return segment.curved
    ? quadraticBezierPoint(segment.from, segment.control, segment.to, eased)
    : lerpPoint(segment.from, segment.to, eased);
}

export function fxPathD(segment: FxSegment, scaleY: (y: number) => number): string {
  return segment.curved
    ? `M${segment.from.x} ${scaleY(segment.from.y)} Q${segment.control.x} ${scaleY(segment.control.y)} ${segment.to.x} ${scaleY(segment.to.y)}`
    : `M${segment.from.x} ${scaleY(segment.from.y)} L${segment.to.x} ${scaleY(segment.to.y)}`;
}

// Efecto #1 (trazo que se dibuja solo): construye el "d" de SOLO la porcion
// ya recorrida, muestreando la MISMA curva/recta punto a punto en vez de
// revelar un path completo con stroke-dasharray/-dashoffset. Fidelidad W27:
// dasharray+dashoffset animado sobre un stroke ancho con round caps en una
// curva produce un artefacto de "cuentas" en Chrome (beads a lo largo del
// trazo) — un path parcial real no tiene ese problema porque no hay dash
// que tiling-ear, es geometria genuina.
export function partialFxPathD(
  segment: FxSegment,
  scaleY: (y: number) => number,
  easedProgress: number,
  steps = 24,
): string {
  const clamped = clamp01(easedProgress);
  if (clamped <= 0) return "";
  const point = (t: number) =>
    segment.curved
      ? quadraticBezierPoint(segment.from, segment.control, segment.to, t)
      : lerpPoint(segment.from, segment.to, t);
  const start = point(0);
  let d = `M${start.x} ${scaleY(start.y)}`;
  const count = Math.max(1, Math.round(steps * clamped));
  for (let i = 1; i <= count; i += 1) {
    const t = (i / count) * clamped;
    const p = point(t);
    d += ` L${p.x} ${scaleY(p.y)}`;
  }
  return d;
}

export function activeSegmentsAt(segments: FxSegment[], tSeconds: number): FxSegment[] {
  return segments.filter((segment) => tSeconds >= segment.start && tSeconds <= segment.end);
}

// Ids de los objetos "protagonistas" a t: los tramos en curso, o — si la
// jugada ya termino — los del ULTIMO tramo (mantiene el foco en el receptor
// final para el freeze, remate del deck).
export function focusObjectIds(segments: FxSegment[], tSeconds: number): string[] {
  const active = activeSegmentsAt(segments, tSeconds);
  if (active.length > 0) {
    return Array.from(new Set(active.flatMap((segment) => segment.objectIds)));
  }
  const last = segments.at(-1);
  if (last && tSeconds >= last.end) return last.objectIds;
  return [];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Baricentro de los protagonistas a t, en espacio de modelo (0-100x0-100) —
// el llamador decide como proyectarlo a viewBox (recto o rotado portrait).
export function focusPoint(
  segments: FxSegment[],
  tSeconds: number,
  fallback: BoardPoint,
): BoardPoint {
  const active = activeSegmentsAt(segments, tSeconds);
  const points =
    active.length > 0
      ? active.map((segment) => fxPositionAt(segment, tSeconds))
      : (() => {
          const last = segments.at(-1);
          return last && tSeconds >= last.end ? [last.to] : [];
        })();
  if (points.length === 0) return fallback;
  return { x: average(points.map((p) => p.x)), y: average(points.map((p) => p.y)) };
}

// Envolvente de zoom (0..1): sube en el primer 18% de la jugada, sostiene, y
// baja en el ultimo 18% — nunca corta de golpe (regla "easing lento y ancho,
// nunca mareo").
export function cameraZoomEnvelope(tSeconds: number, duration: number): number {
  if (duration <= 0) return 0;
  const rampIn = duration * 0.18;
  const rampOut = duration * 0.18;
  if (tSeconds <= rampIn) return easeInOutQuad(tSeconds / Math.max(rampIn, 0.001));
  if (tSeconds >= duration - rampOut) {
    return easeInOutQuad(Math.max(0, (duration - tSeconds) / Math.max(rampOut, 0.001)));
  }
  return 1;
}

export type TrailPoint = { point: BoardPoint; opacity: number };

// Muestrea N posiciones pasadas del MISMO objeto (mismo tramo activo) para
// una estela que se desvanece — pura funcion de t, cero estado.
export function sampleTrail(
  segment: FxSegment,
  tSeconds: number,
  steps: number,
  stepSeconds: number,
): TrailPoint[] {
  const trail: TrailPoint[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const sampleT = tSeconds - i * stepSeconds;
    if (sampleT < segment.start) break;
    trail.push({
      point: fxPositionAt(segment, sampleT),
      opacity: 1 - i / (steps + 1),
    });
  }
  return trail;
}
