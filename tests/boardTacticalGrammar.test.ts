import { describe, expect, it } from "vitest";
import {
  createBall,
  createPlayerToken,
  createSemanticArrow,
} from "@/board/boardModel";
import { auditScene, evaluateAction } from "@/board/boardTacticalGrammar";
import { sceneWith } from "./fixtures/raiseBlockFixtures";

describe("boardTacticalGrammar — evaluateAction: allow (caso limpio)", () => {
  it("una unica flecha en una escena vacia siempre es allow", () => {
    const nine = createPlayerToken(null, { x: 40, y: 50 }, "ST", 9);
    const scene = sceneWith([nine]);
    const proposed = createSemanticArrow(
      "run",
      { kind: "object", objectId: nine.id },
      { kind: "point", point: { x: 70, y: 50 } },
    );
    expect(evaluateAction(scene, proposed)).toEqual({ verdict: "allow" });
  });
});

describe("boardTacticalGrammar — BLOCK", () => {
  it("B1: segundo desmarque/movimiento del mismo jugador se bloquea", () => {
    const nine = createPlayerToken(null, { x: 40, y: 50 }, "ST", 9);
    const existing = createSemanticArrow(
      "run",
      { kind: "object", objectId: nine.id },
      { kind: "point", point: { x: 70, y: 40 } },
    );
    const scene = sceneWith([nine]);
    scene.arrows = [existing];

    const proposed = createSemanticArrow(
      "movement",
      { kind: "object", objectId: nine.id },
      { kind: "point", point: { x: 65, y: 60 } },
    );
    const result = evaluateAction(scene, proposed);
    expect(result.verdict).toBe("block");
    expect(result.reason).toMatch(/9/);
    expect(result.reason).toMatch(/desmarque|movimiento/i);
  });

  it("B1: no bloquea un 'support' del mismo jugador que ya tiene un desmarque (grupos distintos)", () => {
    const nine = createPlayerToken(null, { x: 40, y: 50 }, "ST", 9);
    const existing = createSemanticArrow(
      "run",
      { kind: "object", objectId: nine.id },
      { kind: "point", point: { x: 70, y: 40 } },
    );
    const scene = sceneWith([nine]);
    scene.arrows = [existing];

    const proposed = createSemanticArrow(
      "support",
      { kind: "object", objectId: nine.id },
      { kind: "point", point: { x: 55, y: 45 } },
    );
    expect(evaluateAction(scene, proposed).verdict).toBe("allow");
  });

  it("B2: flecha duplicada exacta (mismo origen, destino y semantica) se bloquea", () => {
    const eight = createPlayerToken(null, { x: 40, y: 50 }, "CM", 8);
    const ten = createPlayerToken(null, { x: 55, y: 55 }, "CAM", 10);
    const existing = createSemanticArrow(
      "pass",
      { kind: "object", objectId: eight.id },
      { kind: "object", objectId: ten.id },
    );
    const scene = sceneWith([eight, ten]);
    scene.arrows = [existing];

    const proposed = createSemanticArrow(
      "pass",
      { kind: "object", objectId: eight.id },
      { kind: "object", objectId: ten.id },
    );
    const result = evaluateAction(scene, proposed);
    expect(result.verdict).toBe("block");
    expect(result.reason).toMatch(/ya esta dibujada/i);
  });

  it("B3: origen y destino en el mismo jugador se bloquea", () => {
    const four = createPlayerToken(null, { x: 30, y: 40 }, "CB", 4);
    const scene = sceneWith([four]);
    const proposed = createSemanticArrow(
      "pass",
      { kind: "object", objectId: four.id },
      { kind: "object", objectId: four.id },
    );
    const result = evaluateAction(scene, proposed);
    expect(result.verdict).toBe("block");
    expect(result.reason).toMatch(/mismo jugador/i);
  });

  it("B4: accion de balon encadenada desde un jugador ajeno a la secuencia se bloquea", () => {
    const eight = createPlayerToken(null, { x: 40, y: 50 }, "CM", 8);
    const ten = createPlayerToken(null, { x: 55, y: 55 }, "CAM", 10);
    const six = createPlayerToken(null, { x: 20, y: 30 }, "CDM", 6);
    const existing = createSemanticArrow(
      "pass",
      { kind: "object", objectId: eight.id },
      { kind: "object", objectId: ten.id },
    );
    const scene = sceneWith([eight, ten, six]);
    scene.arrows = [existing];

    // El 6 nunca toco la pelota en esta escena (no es origen ni destino de
    // ninguna accion de balon previa).
    const proposed = createSemanticArrow(
      "carry",
      { kind: "object", objectId: six.id },
      { kind: "point", point: { x: 60, y: 30 } },
    );
    const result = evaluateAction(scene, proposed);
    expect(result.verdict).toBe("block");
    expect(result.reason).toMatch(/6/);
  });

  it("B4: la PRIMERA accion de balon de la escena siempre es valida sin importar el origen", () => {
    const six = createPlayerToken(null, { x: 20, y: 30 }, "CDM", 6);
    const scene = sceneWith([six]);
    const proposed = createSemanticArrow(
      "pass",
      { kind: "object", objectId: six.id },
      { kind: "point", point: { x: 40, y: 30 } },
    );
    expect(evaluateAction(scene, proposed).verdict).toBe("allow");
  });

  it("B4: el destinatario de un pase previo puede continuar la secuencia de balon", () => {
    const eight = createPlayerToken(null, { x: 40, y: 50 }, "CM", 8);
    const ten = createPlayerToken(null, { x: 55, y: 55 }, "CAM", 10);
    const existing = createSemanticArrow(
      "pass",
      { kind: "object", objectId: eight.id },
      { kind: "object", objectId: ten.id },
    );
    const scene = sceneWith([eight, ten]);
    scene.arrows = [existing];

    const proposed = createSemanticArrow(
      "shot",
      { kind: "object", objectId: ten.id },
      { kind: "point", point: { x: 95, y: 50 } },
    );
    expect(evaluateAction(scene, proposed).verdict).toBe("allow");
  });
});

describe("boardTacticalGrammar — WARN", () => {
  it("W1: hasta 3 flechas de la misma semantica no advierte", () => {
    const players = [1, 2, 3].map((n) =>
      createPlayerToken(null, { x: 30 + n * 5, y: 40 }, "ST", n),
    );
    const scene = sceneWith(players);
    scene.arrows = players.map((p) =>
      createSemanticArrow(
        "run",
        { kind: "object", objectId: p.id },
        { kind: "point", point: { x: 70, y: 40 } },
      ),
    );
    expect(auditScene(scene).some((w) => w.kind === "kindOverload")).toBe(
      false,
    );
  });

  it("W1: la 4ta flecha de la misma semantica dispara la advertencia", () => {
    const players = [1, 2, 3, 4].map((n) =>
      createPlayerToken(null, { x: 20 + n * 5, y: 40 }, "ST", n),
    );
    const scene = sceneWith(players);
    scene.arrows = players.map((p) =>
      createSemanticArrow(
        "run",
        { kind: "object", objectId: p.id },
        { kind: "point", point: { x: 70, y: 40 } },
      ),
    );
    const warnings = auditScene(scene);
    expect(warnings.some((w) => w.kind === "kindOverload")).toBe(true);

    // evaluateAction sobre la flecha que recien completa el umbral tambien
    // debe devolver warn (no allow silencioso).
    const withThree = sceneWith(players.slice(0, 3));
    withThree.arrows = scene.arrows.slice(0, 3);
    const fourthProposed = scene.arrows[3];
    expect(evaluateAction(withThree, fourthProposed).verdict).toBe("warn");
  });

  it("W2: 4 acciones que salen del mismo token disparan la advertencia", () => {
    const four = createPlayerToken(null, { x: 30, y: 40 }, "CB", 4);
    const targets = [1, 2, 3, 4].map((n) =>
      createPlayerToken(null, { x: 40 + n * 5, y: 40 }, "CM", 10 + n),
    );
    const scene = sceneWith([four, ...targets]);
    scene.arrows = [
      createSemanticArrow("pass", { kind: "object", objectId: four.id }, {
        kind: "object",
        objectId: targets[0].id,
      }),
      createSemanticArrow("support", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 45, y: 45 },
      }),
      createSemanticArrow("cover", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 25, y: 45 },
      }),
      createSemanticArrow("recovery", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 20, y: 50 },
      }),
    ];
    const warnings = auditScene(scene);
    const stack = warnings.find((w) => w.kind === "tokenOverload");
    expect(stack).toBeDefined();
    expect(stack?.text).toMatch(/4/);
  });

  it("W3: acciones ofensiva y defensiva en el mismo token advierten", () => {
    const four = createPlayerToken(null, { x: 30, y: 40 }, "CB", 4);
    const scene = sceneWith([four]);
    scene.arrows = [
      createSemanticArrow("run", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 60, y: 40 },
      }),
      createSemanticArrow("cover", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 20, y: 45 },
      }),
    ];
    const warnings = auditScene(scene);
    expect(warnings.some((w) => w.kind === "mixedIntent")).toBe(true);
  });

  it("W3: dos acciones ofensivas del mismo token no advierten mezcla (sin defensiva)", () => {
    const four = createPlayerToken(null, { x: 30, y: 40 }, "CB", 4);
    const scene = sceneWith([four]);
    scene.arrows = [
      createSemanticArrow("run", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 60, y: 40 },
      }),
      createSemanticArrow("support", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 50, y: 45 },
      }),
    ];
    expect(
      auditScene(scene).some((w) => w.kind === "mixedIntent"),
    ).toBe(false);
  });
});

describe("boardTacticalGrammar — auditScene: derivado, no acumulado", () => {
  it("una advertencia desaparece si la flecha que la disparaba ya no esta (equivalente a undo)", () => {
    const four = createPlayerToken(null, { x: 30, y: 40 }, "CB", 4);
    const scene = sceneWith([four]);
    scene.arrows = [
      createSemanticArrow("run", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 60, y: 40 },
      }),
      createSemanticArrow("cover", { kind: "object", objectId: four.id }, {
        kind: "point",
        point: { x: 20, y: 45 },
      }),
    ];
    expect(auditScene(scene).some((w) => w.kind === "mixedIntent")).toBe(
      true,
    );

    const afterUndo = { ...scene, arrows: scene.arrows.slice(0, 1) };
    expect(
      auditScene(afterUndo).some((w) => w.kind === "mixedIntent"),
    ).toBe(false);
  });

  it("escena sin flechas -> auditScene vacio", () => {
    const scene = sceneWith([createBall()]);
    expect(auditScene(scene)).toEqual([]);
  });
});
