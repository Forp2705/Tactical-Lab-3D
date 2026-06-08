import { describe, expect, it } from "vitest";
import {
  autoAssign,
  preserveOrAutoAssign,
  type FormationSlot,
} from "../src/team/LineupLab3D";
import type { Player } from "../src/data";

/**
 * Regression coverage for the RB/LB slot/position mismatch fix (Real Workspace
 * UX Integrity Pass). The bug: a player configured as RB (e.g. "Fede" /
 * "Derecho") rendered on the LEFT side labeled LB. Root cause was that
 * `autoAssign`/`preserveOrAutoAssign` resolved slots in formation order with
 * an immediate "first unused player" fallback — so an early slot with no
 * naturally-compatible candidate (e.g. no LB in the squad) grabbed a player
 * who actually fit a *later* slot (the squad's only RB), placing them on the
 * wrong side under the wrong label. The fix commits role-compatible matches
 * across all slots first, and only then fills remaining empty slots with
 * leftovers.
 */

function player(id: string, name: string, positions: Player["positions"]): Player {
  return {
    id,
    name,
    num: Number(id.replace(/\D/g, "")) || 1,
    positions,
    foot: "R",
    status: "available",
    profile: "balanced",
    attributes: {
      speed: 60,
      stamina: 60,
      pass: 60,
      control: 60,
      press: 60,
      duel: 60,
      tactical: 60,
    },
  };
}

describe("LineupLab3D — autoAssign keeps RB/LB players in their natural slot", () => {
  it("never lets an empty LB slot steal the squad's only RB player via premature fallback", () => {
    const fede = player("1", "Fede", ["RB"]);
    const central = player("2", "Central", ["CB"]);
    const players = [fede, central]; // Fede listed first — this is what triggered the old bug.

    const slots: FormationSlot[] = [
      { role: "LB", pos: { x: 80, y: 20 } },
      { role: "RB", pos: { x: 80, y: 80 } },
    ];

    const assignment = autoAssign(players, slots);

    // Fede (RB) must land in the RB slot (index 1), not get pulled into LB.
    expect(assignment[1]).toBe(fede.id);
    expect(assignment[0]).not.toBe(fede.id);
    // The LB slot, with no natural LB candidate, falls back to whoever is left.
    expect(assignment[0]).toBe(central.id);
  });

  it("places an explicit LB player in the LB slot and the RB player in the RB slot when both exist", () => {
    const fede = player("1", "Fede", ["RB"]);
    const lateral = player("2", "Lateral Izquierdo", ["LB"]);
    const players = [fede, lateral];

    const slots: FormationSlot[] = [
      { role: "LB", pos: { x: 80, y: 20 } },
      { role: "RB", pos: { x: 80, y: 80 } },
    ];

    const assignment = autoAssign(players, slots);

    expect(assignment[0]).toBe(lateral.id);
    expect(assignment[1]).toBe(fede.id);
  });
});

describe("LineupLab3D — preserveOrAutoAssign preserves valid placements without role-stealing", () => {
  it("keeps a previously-assigned RB in place and does not let an empty LB slot steal them on re-resolve", () => {
    const fede = player("1", "Fede", ["RB"]);
    const central = player("2", "Central", ["CB"]);
    const players = [fede, central];

    const slots: FormationSlot[] = [
      { role: "LB", pos: { x: 80, y: 20 } },
      { role: "RB", pos: { x: 80, y: 80 } },
    ];

    // Fede is already correctly placed at index 1 (RB); index 0 (LB) is empty.
    const current = ["", fede.id];

    const assignment = preserveOrAutoAssign(current, players, slots);

    expect(assignment[1]).toBe(fede.id);
    expect(assignment[0]).toBe(central.id);
  });

  it("fills empty slots with role-compatible players first, matching autoAssign's ordering guarantee", () => {
    const fede = player("1", "Fede", ["RB"]);
    const lateral = player("2", "Lateral Izquierdo", ["LB"]);
    const players = [fede, lateral];

    const slots: FormationSlot[] = [
      { role: "LB", pos: { x: 80, y: 20 } },
      { role: "RB", pos: { x: 80, y: 80 } },
    ];

    const assignment = preserveOrAutoAssign(["", ""], players, slots);

    expect(assignment[0]).toBe(lateral.id);
    expect(assignment[1]).toBe(fede.id);
  });
});
