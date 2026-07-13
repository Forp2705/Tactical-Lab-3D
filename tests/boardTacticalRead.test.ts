import { describe, expect, it } from "vitest";
import { deriveTacticalReads } from "@/board/boardTacticalRead";
import {
  createBall,
  createOpponentToken,
  createPlayerToken,
  createSemanticArrow,
} from "@/board/boardModel";
import type { Player } from "@/data";
import { makePlayer, sceneWith } from "./fixtures/raiseBlockFixtures";

function withPositions(player: Player, positions: Player["positions"]): Player {
  return { ...player, positions };
}

describe("deriveTacticalReads — lateralBias (la feature estrella)", () => {
  it("LB adelantado, RB retrasado (dir 1) -> lectura de sesgo hacia la izquierda", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 60, y: 20 }, "LB", 3),
      createPlayerToken(null, { x: 40, y: 80 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const lateral = reads.find((r) => r.kind === "lateralBias");
    expect(lateral).toBeDefined();
    expect(lateral?.text).toMatch(/izquierdo/i);
    expect(lateral?.text).toMatch(/\+20/);
    expect(lateral?.grounded).toBe(true);
    expect(lateral?.overlaySide).toBe("left");
  });

  it("mismo caso con dir -1 (ataque hacia -x) invierte la lectura a el lado derecho", () => {
    // Mismas fichas, pero el equipo ataca hacia -x: el RB (x=40) esta MAS
    // adelantado en la direccion de ataque que el LB (x=60).
    const scene = sceneWith([
      createPlayerToken(null, { x: 92, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 60, y: 20 }, "LB", 3),
      createPlayerToken(null, { x: 40, y: 80 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, -1);
    const lateral = reads.find((r) => r.kind === "lateralBias");
    expect(lateral?.text).toMatch(/derecho/i);
  });

  it("forma equilibrada (diferencia < 15u) -> silencio, no chip vacio", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 50, y: 20 }, "LB", 3),
      createPlayerToken(null, { x: 45, y: 80 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "lateralBias")).toBeUndefined();
  });

  it("HONESTIDAD CRITICA: sin rol escrito ni linkedPlayerId -> silencio, nunca adivina por y", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      // Dos fichas con asimetria de banda clara (y=20 / y=80) pero SIN rol
      // reconocible ("Juan"/"Pedro" no matchean LB/RB) y sin linkedPlayerId.
      createPlayerToken(null, { x: 60, y: 20 }, "Juan", 3),
      createPlayerToken(null, { x: 40, y: 80 }, "Pedro", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "lateralBias")).toBeUndefined();
  });

  it("fallback a linkedPlayerId -> Player.positions cuando el rol de la ficha no matchea", () => {
    const lb = withPositions(makePlayer("p-lb", "Nico", 3), ["LB"]);
    const rb = withPositions(makePlayer("p-rb", "Bruno", 2), ["RB"]);
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      // role queda como el nombre del jugador (no matchea el regex), la
      // resolucion depende del roster via linkedPlayerId.
      createPlayerToken(lb, { x: 60, y: 20 }, "Nico", 3),
      createPlayerToken(rb, { x: 40, y: 80 }, "Bruno", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1, [lb, rb]);
    const lateral = reads.find((r) => r.kind === "lateralBias");
    expect(lateral).toBeDefined();
    expect(lateral?.evidenceLevel).toBe("partial");
  });

  it("evidenceLevel es 'sufficient' cuando ambos lados resuelven por rol de texto directo", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 60, y: 20 }, "LB", 3),
      createPlayerToken(null, { x: 40, y: 80 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "lateralBias")?.evidenceLevel).toBe(
      "sufficient",
    );
  });

  it("RED-CHECK calibracion: el wing NO contamina el ancla de banda; ancla al lateral (LB), no al LW", () => {
    // Banda izquierda con DOS tokens resolubles: el LW dibujado PRIMERO y mas
    // adelantado (x=90), el LB despues (x=70). El motor viejo anclaba al primer
    // "left" por orden de escena -> tomaba el LW -> +45. La calibracion ancla al
    // lateral literal (LB, mas retrasado que el wing) -> +25.
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 90, y: 15 }, "LW", 11), // wing, primero en escena
      createPlayerToken(null, { x: 70, y: 30 }, "LB", 3), // lateral literal
      createPlayerToken(null, { x: 45, y: 80 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const lateral = reads.find((r) => r.kind === "lateralBias");
    expect(lateral?.text).toMatch(/izquierdo/i);
    expect(lateral?.text).toMatch(/\+25\b/);
    expect(lateral?.text).not.toMatch(/\+45/);
  });

  it("dos laterales del mismo lado -> ancla al MAS RETRASADO (medicion, no adivinanza de lado)", () => {
    // Dos LB en la banda izquierda: uno metido atras (x=55), otro proyectado
    // (x=88). Desambiguar CUAL de dos tokens del MISMO lado ya resuelto por rol
    // se hace por avance (legitimo): ancla al mas retrasado (x=55) -> +10.
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 88, y: 15 }, "LB", 3),
      createPlayerToken(null, { x: 55, y: 30 }, "LB", 13),
      createPlayerToken(null, { x: 45, y: 80 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const lateral = reads.find((r) => r.kind === "lateralBias");
    expect(lateral).toBeUndefined(); // 55 vs 45 = +10 < umbral 15 -> silencio
  });

  it("sin par resoluble (un lado sin lateral/wing) -> silencio", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 90, y: 15 }, "LW", 11),
      createPlayerToken(null, { x: 70, y: 30 }, "LB", 3),
      // derecha: solo un mediocampista central, no resuelve lado -> sin par
      createPlayerToken(null, { x: 45, y: 55 }, "CM", 8),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "lateralBias")).toBeUndefined();
  });
});

describe("deriveTacticalReads — blockHeight", () => {
  it("linea defensiva reconocible en el tercio bajo -> lectura de bloque bajo", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 15, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 17, y: 60 }, "CB", 5),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const block = reads.find((r) => r.kind === "blockHeight");
    expect(block?.text).toMatch(/bajo/i);
    expect(block?.overlayX).toBeCloseTo(16, 0);
  });

  it("linea defensiva en el tercio alto -> lectura de bloque alto", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 70, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 72, y: 60 }, "CB", 5),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "blockHeight")?.text).toMatch(/alto/i);
  });

  it("menos de 2 defensores con rol reconocible -> silencio (no numero fabricado)", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 15, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 50, y: 50 }, "Comodin", 8),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "blockHeight")).toBeUndefined();
  });

  it("linea defensiva en el tercio medio -> lectura de bloque medio", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 48, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 50, y: 60 }, "CB", 5),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "blockHeight")?.text).toMatch(/medio/i);
  });

  it("RED-CHECK calibracion: un wing adelantado NO corre la altura del bloque (solo linea defensiva)", () => {
    // Dos centrales metidos atras (bloque bajo). Dos wings pegados a la ultima
    // linea rival (x=85). El motor viejo contaba LW/RW como 'backs' via la regex
    // LEFT/RIGHT y promediaba a 'medio' (x~50); la calibracion solo cuenta la
    // linea defensiva (CB + laterales) -> el bloque sigue leyendose 'bajo'.
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 15, y: 40 }, "CB", 4),
      createPlayerToken(null, { x: 17, y: 60 }, "CB", 5),
      createPlayerToken(null, { x: 85, y: 10 }, "LW", 11),
      createPlayerToken(null, { x: 85, y: 90 }, "RW", 7),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const block = reads.find((r) => r.kind === "blockHeight");
    expect(block?.text).toMatch(/bajo/i);
    expect(block?.overlayX).toBeCloseTo(16, 0);
  });

  it("los laterales SI integran la linea defensiva (afectan altura y confianza)", () => {
    // CB+CB+LB+RB, los cuatro en el tercio alto -> bloque alto y confianza alta
    // (>=3 backs). Si los laterales quedaran fuera contarian solo 2 CBs
    // (confianza media): la asercion de confianza 'high' bloquea esa regresion.
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 70, y: 30 }, "CB", 4),
      createPlayerToken(null, { x: 70, y: 70 }, "CB", 5),
      createPlayerToken(null, { x: 72, y: 15 }, "LB", 3),
      createPlayerToken(null, { x: 72, y: 85 }, "RB", 2),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const block = reads.find((r) => r.kind === "blockHeight");
    expect(block?.text).toMatch(/alto/i);
    expect(block?.confidence).toBe("high");
    expect(block?.evidenceLevel).toBe("sufficient");
  });
});

describe("deriveTacticalReads — amplitude", () => {
  it("dispersion ancha (>=60u) -> lectura de amplitud", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 50, y: 10 }, "LW", 11),
      createPlayerToken(null, { x: 50, y: 90 }, "RW", 7),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "amplitude")?.text).toMatch(/amplio/i);
  });

  it("dispersion angosta (<=30u) -> lectura de compactacion", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 50, y: 45 }, "CM", 8),
      createPlayerToken(null, { x: 50, y: 55 }, "CM", 6),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "amplitude")?.text).toMatch(
      /compact/i,
    );
  });

  it("dispersion intermedia (30-60u) -> silencio, no hay señal notable", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
      createPlayerToken(null, { x: 50, y: 30 }, "CM", 8),
      createPlayerToken(null, { x: 50, y: 75 }, "CM", 6),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "amplitude")).toBeUndefined();
  });
});

describe("deriveTacticalReads — zoneSuperiority", () => {
  it("con balon y rival en escena, cuenta propios vs rivales alrededor del balon", () => {
    const scene = sceneWith([
      createBall({ x: 50, y: 50 }),
      createPlayerToken(null, { x: 48, y: 48 }, "CM", 8),
      createPlayerToken(null, { x: 52, y: 52 }, "CM", 6),
      createOpponentToken({ x: 51, y: 51 }, "CM", 5),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    const zone = reads.find((r) => r.kind === "zoneSuperiority");
    expect(zone).toBeDefined();
    expect(zone?.text).toMatch(/2.*1|1.*2/);
  });

  it("sin balon en la escena -> silencio", () => {
    const scene = sceneWith([
      createPlayerToken(null, { x: 48, y: 48 }, "CM", 8),
      createOpponentToken({ x: 51, y: 51 }, "CM", 5),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "zoneSuperiority")).toBeUndefined();
  });

  it("sin rival en la escena -> silencio", () => {
    const scene = sceneWith([
      createBall({ x: 50, y: 50 }),
      createPlayerToken(null, { x: 48, y: 48 }, "CM", 8),
    ]);
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "zoneSuperiority")).toBeUndefined();
  });
});

describe("deriveTacticalReads — wideArrowBias", () => {
  it("flecha cross con destino ancho (y<20) -> lectura de juego por afuera", () => {
    const scene = {
      ...sceneWith([createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)]),
      arrows: [
        createSemanticArrow(
          "cross",
          { kind: "point", point: { x: 60, y: 60 } },
          { kind: "point", point: { x: 80, y: 10 } },
        ),
      ],
    };
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "wideArrowBias")).toBeDefined();
  });

  it("sin flechas cross/switch/longPass anchas -> silencio", () => {
    const scene = {
      ...sceneWith([createPlayerToken(null, { x: 8, y: 50 }, "GK", 1)]),
      arrows: [
        createSemanticArrow(
          "pass",
          { kind: "point", point: { x: 40, y: 50 } },
          { kind: "point", point: { x: 55, y: 55 } },
        ),
      ],
    };
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.find((r) => r.kind === "wideArrowBias")).toBeUndefined();
  });
});

describe("deriveTacticalReads — tope de 3 lecturas", () => {
  it("una escena que dispara las 5 lecturas devuelve como maximo 3, priorizando la tabla", () => {
    const scene = {
      ...sceneWith([
        createBall({ x: 50, y: 50 }),
        createPlayerToken(null, { x: 8, y: 50 }, "GK", 1),
        createPlayerToken(null, { x: 60, y: 20 }, "LB", 3), // lateralBias
        createPlayerToken(null, { x: 40, y: 80 }, "RB", 2),
        createPlayerToken(null, { x: 15, y: 45 }, "CB", 4), // blockHeight (bajo)
        createPlayerToken(null, { x: 17, y: 55 }, "CB", 5),
        createPlayerToken(null, { x: 50, y: 5 }, "LW", 11), // amplitude (amplio)
        createPlayerToken(null, { x: 50, y: 95 }, "RW", 7),
        createOpponentToken({ x: 51, y: 51 }, "CM", 5), // zoneSuperiority
      ]),
      arrows: [
        createSemanticArrow(
          "cross",
          { kind: "point", point: { x: 60, y: 60 } },
          { kind: "point", point: { x: 80, y: 10 } },
        ), // wideArrowBias
      ],
    };
    const reads = deriveTacticalReads(scene, 1);
    expect(reads.length).toBeLessThanOrEqual(3);
    expect(reads.map((r) => r.kind)).toEqual([
      "lateralBias",
      "blockHeight",
      "amplitude",
    ]);
  });
});
