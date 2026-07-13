// src/board/boardTacticalGrammar.ts — pure, client-safe, ZERO ties to React
// or the coach. Catalog + reasoning: see GRAMMAR-RULES.md at the repo root;
// any change to a rule or threshold starts there, not here.
//
// Isolation (same hard rule as boardTacticalRead.ts): this file must NEVER
// import from or be imported by CoachAgent.ts, CoachSchemas.ts,
// coachAgentClient.ts, or anything under api/. It is a sibling engine to
// boardTacticalRead.ts, not an extension — geometry/lecturas semantics live
// there and are not touched here.
import { labelForArrow } from "./boardModel";
import type {
  BoardArrow,
  BoardArrowEndpoint,
  BoardArrowSemantic,
  BoardScene,
} from "./boardModel";

export type GrammarVerdict = "allow" | "warn" | "block";

export type GrammarEvaluation = {
  verdict: GrammarVerdict;
  // Presente en "warn" y "block", ausente en "allow". Siempre en lenguaje de
  // cuerpo tecnico (GRAMMAR-RULES.md principio 1) — nunca jerga de sistema.
  reason?: string;
};

export type GrammarWarningKind = "kindOverload" | "tokenOverload" | "mixedIntent";

export type GrammarWarning = {
  id: string;
  kind: GrammarWarningKind;
  text: string;
  tokenId?: string;
};

// B1: grupo "movimiento libre" (GRAMMAR-RULES.md B1). Deliberadamente NO
// incluye support/rotation — ver razonamiento en el catalogo.
const MOVEMENT_SEMANTICS = new Set<BoardArrowSemantic>(["movement", "run"]);

// B4/W3: secuencia de balon (GRAMMAR-RULES.md B4).
const BALL_SEMANTICS = new Set<BoardArrowSemantic>([
  "pass",
  "longPass",
  "cross",
  "switch",
  "carry",
  "shot",
]);

// W3: grupos ofensivo/defensivo por semantica de origen, no por `arrow.layer`
// (razon documentada en GRAMMAR-RULES.md, principio 4: layer es un cache que
// no se resincroniza si se edita la semantica de una flecha existente).
const OFFENSIVE_SEMANTICS = new Set<BoardArrowSemantic>([
  "movement",
  "run",
  "pass",
  "longPass",
  "cross",
  "switch",
  "carry",
  "support",
  "rotation",
  "shot",
]);
const DEFENSIVE_SEMANTICS = new Set<BoardArrowSemantic>([
  "pressure",
  "cover",
  "recovery",
  "mark",
]);

// W1/W2: umbrales razonados en GRAMMAR-RULES.md ("Resumen de umbrales").
const SAME_KIND_WARN_THRESHOLD = 4;
const TOKEN_STACK_WARN_THRESHOLD = 4;

function sameEndpoint(a: BoardArrowEndpoint, b: BoardArrowEndpoint): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "object" && b.kind === "object") {
    return a.objectId === b.objectId;
  }
  if (a.kind === "point" && b.kind === "point") {
    return a.point.x === b.point.x && a.point.y === b.point.y;
  }
  return false;
}

function originObjectId(arrow: BoardArrow): string | null {
  return arrow.from.kind === "object" ? arrow.from.objectId : null;
}

function destinationObjectId(arrow: BoardArrow): string | null {
  return arrow.to.kind === "object" ? arrow.to.objectId : null;
}

function tokenLabel(scene: BoardScene, objectId: string | null): string {
  if (!objectId) return "El jugador";
  const object = scene.objects.find((item) => item.id === objectId);
  if (!object) return "El jugador";
  if (typeof object.number === "number") return `El ${object.number}`;
  if (object.role) return `El ${object.role}`;
  return object.label;
}

// --- BLOCK rules (GRAMMAR-RULES.md) ---

function checkSelfLoop(_scene: BoardScene, proposed: BoardArrow): string | null {
  if (
    proposed.from.kind === "object" &&
    proposed.to.kind === "object" &&
    proposed.from.objectId === proposed.to.objectId
  ) {
    return "El origen y el destino son el mismo jugador: no tiene sentido dibujar esta accion asi.";
  }
  return null;
}

function checkDuplicateArrow(scene: BoardScene, proposed: BoardArrow): string | null {
  const duplicate = scene.arrows.some(
    (arrow) =>
      arrow.semantic === proposed.semantic &&
      sameEndpoint(arrow.from, proposed.from) &&
      sameEndpoint(arrow.to, proposed.to),
  );
  return duplicate
    ? "Esa misma accion ya esta dibujada, igual, en esta escena."
    : null;
}

function checkDoubleMovement(scene: BoardScene, proposed: BoardArrow): string | null {
  if (!MOVEMENT_SEMANTICS.has(proposed.semantic)) return null;
  const originId = originObjectId(proposed);
  if (!originId) return null;
  const alreadyMoving = scene.arrows.some(
    (arrow) =>
      MOVEMENT_SEMANTICS.has(arrow.semantic) && originObjectId(arrow) === originId,
  );
  if (!alreadyMoving) return null;
  return `${tokenLabel(scene, originId)} ya tiene un desmarque o movimiento marcado en esta escena: no puede hacer dos a la vez.`;
}

function checkUnrelatedBallChain(scene: BoardScene, proposed: BoardArrow): string | null {
  if (!BALL_SEMANTICS.has(proposed.semantic)) return null;
  const originId = originObjectId(proposed);
  if (!originId) return null; // origen libre (punto suelto): nada que validar
  const priorBallArrows = scene.arrows.filter((arrow) => BALL_SEMANTICS.has(arrow.semantic));
  if (priorBallArrows.length === 0) return null; // primera accion de balon: siempre valida
  const intervened = priorBallArrows.some(
    (arrow) => originObjectId(arrow) === originId || destinationObjectId(arrow) === originId,
  );
  if (intervened) return null;
  return `${tokenLabel(scene, originId)} no participo antes en esta jugada con el balon: no puede continuarla.`;
}

const BLOCK_RULES: Array<(scene: BoardScene, proposed: BoardArrow) => string | null> = [
  checkSelfLoop,
  checkDuplicateArrow,
  checkDoubleMovement,
  checkUnrelatedBallChain,
];

// --- WARN rules (GRAMMAR-RULES.md) — operan sobre una lista de flechas dada
// (permite reutilizarlas tanto para auditScene, sobre lo ya comiteado, como
// para evaluateAction, sobre lo ya comiteado + la propuesta).

function computeKindOverloadWarnings(arrows: BoardArrow[]): GrammarWarning[] {
  const counts = new Map<BoardArrowSemantic, number>();
  for (const arrow of arrows) {
    counts.set(arrow.semantic, (counts.get(arrow.semantic) ?? 0) + 1);
  }
  const warnings: GrammarWarning[] = [];
  for (const [semantic, count] of counts) {
    if (count >= SAME_KIND_WARN_THRESHOLD) {
      warnings.push({
        id: `kind-overload-${semantic}`,
        kind: "kindOverload",
        text: `Hay ${count} acciones de "${labelForArrow(semantic)}" en esta escena: revisa si cada una representa una conducta distinta o si conviene simplificar.`,
      });
    }
  }
  return warnings;
}

function computeTokenStackWarnings(
  scene: BoardScene,
  arrows: BoardArrow[],
): GrammarWarning[] {
  const counts = new Map<string, number>();
  for (const arrow of arrows) {
    const originId = originObjectId(arrow);
    if (!originId) continue;
    counts.set(originId, (counts.get(originId) ?? 0) + 1);
  }
  const warnings: GrammarWarning[] = [];
  for (const [objectId, count] of counts) {
    if (count >= TOKEN_STACK_WARN_THRESHOLD) {
      warnings.push({
        id: `token-overload-${objectId}`,
        kind: "tokenOverload",
        tokenId: objectId,
        text: `${tokenLabel(scene, objectId)} concentra ${count} acciones en esta escena: puede volverse dificil de leer para el jugador.`,
      });
    }
  }
  return warnings;
}

function computeMixedIntentWarnings(
  scene: BoardScene,
  arrows: BoardArrow[],
): GrammarWarning[] {
  const offensiveTokens = new Set<string>();
  const defensiveTokens = new Set<string>();
  for (const arrow of arrows) {
    const originId = originObjectId(arrow);
    if (!originId) continue;
    if (OFFENSIVE_SEMANTICS.has(arrow.semantic)) offensiveTokens.add(originId);
    if (DEFENSIVE_SEMANTICS.has(arrow.semantic)) defensiveTokens.add(originId);
  }
  const warnings: GrammarWarning[] = [];
  for (const objectId of offensiveTokens) {
    if (!defensiveTokens.has(objectId)) continue;
    warnings.push({
      id: `mixed-intent-${objectId}`,
      kind: "mixedIntent",
      tokenId: objectId,
      text: `${tokenLabel(scene, objectId)} tiene una accion ofensiva y una defensiva marcadas en la misma escena: confirma si es la idea o es una mezcla accidental.`,
    });
  }
  return warnings;
}

function computeWarnings(scene: BoardScene, arrows: BoardArrow[]): GrammarWarning[] {
  return [
    ...computeKindOverloadWarnings(arrows),
    ...computeTokenStackWarnings(scene, arrows),
    ...computeMixedIntentWarnings(scene, arrows),
  ];
}

/**
 * Lista de advertencias vigentes en una escena tal como esta, HOY —
 * derivada, nunca acumulada: undo/borrado de una flecha hace que la
 * advertencia que dependia de ella desaparezca en la siguiente llamada, sin
 * estado propio que limpiar.
 */
export function auditScene(scene: BoardScene): GrammarWarning[] {
  return computeWarnings(scene, scene.arrows);
}

/**
 * Evalua una flecha propuesta (todavia NO agregada a la escena) contra el
 * catalogo completo. BLOCK gana siempre sobre WARN (una accion imposible no
 * se "permite con aviso"). Si ninguna regla de BLOCK dispara, se revisa si
 * agregar esta flecha crea una advertencia NUEVA (que auditScene(scene) sola
 * -sin la propuesta- todavia no mostraba) — evita reportar "warn" por una
 * condicion que ya estaba activa antes de esta accion.
 */
export function evaluateAction(
  scene: BoardScene,
  proposedArrow: BoardArrow,
): GrammarEvaluation {
  for (const rule of BLOCK_RULES) {
    const reason = rule(scene, proposedArrow);
    if (reason) return { verdict: "block", reason };
  }

  const before = computeWarnings(scene, scene.arrows);
  const after = computeWarnings(scene, [...scene.arrows, proposedArrow]);
  const newWarnings = after.filter(
    (warning) => !before.some((prior) => prior.id === warning.id),
  );
  if (newWarnings.length > 0) {
    return { verdict: "warn", reason: newWarnings[0].text };
  }
  return { verdict: "allow" };
}
