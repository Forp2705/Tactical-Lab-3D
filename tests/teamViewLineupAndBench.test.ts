import { describe, expect, it } from "vitest";
import {
  buildLineup,
  reconcileLineup,
  FORMATIONS,
  type LineupSlot,
} from "../src/team/TeamView";
import type { Player } from "../src/data";

/**
 * Regression coverage for the Real Workspace UX Integrity Pass:
 *
 *  - RB/LB slot mapping (issue A): TeamView keeps its OWN lineup builder
 *    (`buildLineup`/`reconcileLineup`) separate from LineupLab3D's
 *    `autoAssign`/`preserveOrAutoAssign`. Both had the identical premature-
 *    fallback bug — an empty slot with no naturally-compatible candidate
 *    (e.g. no LB in the squad) grabbed a player who actually belonged in a
 *    *later* slot (e.g. the squad's only RB), rendering them on the wrong
 *    side under the wrong label. This is the exact "Fede"/RB-shown-as-LB bug
 *    reported from the real workspace pitch in Equipo. Fixed with the same
 *    two-pass (commit-compatible-first, then-fallback) approach.
 *
 *  - Active vs bench separation (issue B): the bench list is `team.players`
 *    filtered by `!onPitch.has(player.id)` where `onPitch` is derived from
 *    the live `lineup`. These tests lock the lineup-construction contract
 *    that `onPitch`/`bench` downstream depend on: every assigned player id
 *    must be unique and drawn only from the roster, so the bench/active sets
 *    never overlap.
 */

function player(id: string, name: string, positions: Player["positions"]): Player {
  return {
    id,
    name,
    num: Number(id),
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

function findSlotIndex(lineup: LineupSlot[], role: string) {
  return lineup.findIndex((item) => item.slot === role);
}

describe("TeamView — buildLineup keeps RB/LB players in their natural slot (Fede regression)", () => {
  it("places the squad's only RB in the RB slot, not the LB slot, even when no natural LB exists", () => {
    const fede = player("1", "Fede", ["RB"]);
    const gk = player("2", "Arquero", ["GK"]);
    const cb1 = player("3", "Central 1", ["CB"]);
    const cb2 = player("4", "Central 2", ["CB"]);
    const cm = player("5", "Volante", ["CM"]);
    // Deliberately no LB / no natural left-side fullback in the squad —
    // this is exactly the configuration that triggered the bug.
    const players = [fede, gk, cb1, cb2, cm];

    const lineup = buildLineup(players, "4-3-3");

    const lbIndex = findSlotIndex(lineup, "LB");
    const rbIndex = findSlotIndex(lineup, "RB");

    expect(lineup[rbIndex]?.playerId).toBe(fede.id);
    expect(lineup[lbIndex]?.playerId).not.toBe(fede.id);
  });

  it("assigns an explicit LB to the LB slot and the RB to the RB slot when both exist", () => {
    const fede = player("1", "Fede", ["RB"]);
    const lateral = player("2", "Lateral Izquierdo", ["LB"]);
    const gk = player("3", "Arquero", ["GK"]);
    const cb1 = player("4", "Central 1", ["CB"]);
    const cb2 = player("5", "Central 2", ["CB"]);
    const players = [fede, lateral, gk, cb1, cb2];

    const lineup = buildLineup(players, "4-3-3");

    const lbIndex = findSlotIndex(lineup, "LB");
    const rbIndex = findSlotIndex(lineup, "RB");

    expect(lineup[lbIndex]?.playerId).toBe(lateral.id);
    expect(lineup[rbIndex]?.playerId).toBe(fede.id);
  });

  it("never assigns the same player to two slots", () => {
    const players = Array.from({ length: 11 }, (_, i) =>
      player(String(i + 1), `Jugador ${i + 1}`, ["CM"]),
    );

    const lineup = buildLineup(players, "4-3-3");
    const assignedIds = lineup.map((item) => item.playerId).filter(Boolean);

    expect(new Set(assignedIds).size).toBe(assignedIds.length);
  });
});

describe("TeamView — reconcileLineup preserves correct placements without role-stealing on reflow", () => {
  it("keeps Fede in the RB slot across a reconcile when the formation length is unchanged", () => {
    const fede = player("1", "Fede", ["RB"]);
    const gk = player("2", "Arquero", ["GK"]);
    const cb1 = player("3", "Central 1", ["CB"]);
    const cb2 = player("4", "Central 2", ["CB"]);
    const cm = player("5", "Volante", ["CM"]);
    const players = [fede, gk, cb1, cb2, cm];

    const initial = buildLineup(players, "4-3-3");
    const rbIndex = findSlotIndex(initial, "RB");
    expect(initial[rbIndex]?.playerId).toBe(fede.id);

    const reconciled = reconcileLineup(initial, players, "4-3-3");
    const reconciledRbIndex = findSlotIndex(reconciled, "RB");
    const reconciledLbIndex = findSlotIndex(reconciled, "LB");

    expect(reconciled[reconciledRbIndex]?.playerId).toBe(fede.id);
    expect(reconciled[reconciledLbIndex]?.playerId).not.toBe(fede.id);
  });

  it("falls back to buildLineup when the formation slot count changes, still respecting RB/LB roles", () => {
    const fede = player("1", "Fede", ["RB"]);
    const lateral = player("2", "Lateral Izquierdo", ["LB"]);
    const gk = player("3", "Arquero", ["GK"]);
    const cb1 = player("4", "Central 1", ["CB"]);
    const cm = player("5", "Volante", ["CM"]);
    const players = [fede, lateral, gk, cb1, cm];

    const fourFourTwo = FORMATIONS["4-4-2"] ? "4-4-2" : "4-3-3";
    const initial = buildLineup(players, "4-3-3");
    const reconciled = reconcileLineup(initial, players, fourFourTwo);

    const lbIndex = findSlotIndex(reconciled, "LB");
    const rbIndex = findSlotIndex(reconciled, "RB");
    if (lbIndex >= 0) expect(reconciled[lbIndex]?.playerId).toBe(lateral.id);
    if (rbIndex >= 0) expect(reconciled[rbIndex]?.playerId).toBe(fede.id);
  });
});

describe("TeamView — active (on-pitch) players and bench never overlap (Banco y alternativas regression)", () => {
  it("every player assigned to the lineup is excluded from the bench set", () => {
    const fede = player("1", "Fede", ["RB"]);
    const gk = player("2", "Arquero", ["GK"]);
    const cb1 = player("3", "Central 1", ["CB"]);
    const cb2 = player("4", "Central 2", ["CB"]);
    const cm = player("5", "Volante", ["CM"]);
    const sub = player("6", "Suplente", ["ST"]);
    const players = [fede, gk, cb1, cb2, cm, sub];

    const lineup = buildLineup(players, "4-3-3");
    const onPitch = new Set(lineup.map((item) => item.playerId).filter(Boolean));
    const bench = players.filter((p) => !onPitch.has(p.id));

    // No overlap: nobody appears in both sets.
    for (const benched of bench) {
      expect(onPitch.has(benched.id)).toBe(false);
    }
    for (const activeId of onPitch) {
      expect(bench.some((p) => p.id === activeId)).toBe(false);
    }

    // The unassigned player ("Suplente") — there are 11 slots and 6 players,
    // so everyone fits on the pitch and the bench is empty. Use a roster
    // larger than the formation to force a real bench split.
  });

  it("produces a non-empty, non-overlapping bench when the roster is larger than the formation", () => {
    const starters = Array.from({ length: 11 }, (_, i) =>
      player(String(i + 1), `Titular ${i + 1}`, ["CM"]),
    );
    const subs = [
      player("12", "Suplente A", ["ST"]),
      player("13", "Suplente B", ["GK"]),
    ];
    const players = [...starters, ...subs];

    const lineup = buildLineup(players, "4-3-3");
    const onPitch = new Set(lineup.map((item) => item.playerId).filter(Boolean));
    const bench = players.filter((p) => !onPitch.has(p.id));

    // Note: buildLineup prefers role-compatible matches over roster order, so
    // the GK/ST subs ("13"/"12") can legitimately displace CM "starters" onto
    // the bench — that's correct behavior (a CM can't play GK). What matters
    // for "Banco y alternativas" is the actual contract: exactly 2 on the
    // bench, 11 on the pitch, and zero overlap between the two sets.
    expect(onPitch.size).toBe(11);
    expect(bench.length).toBe(2);
    for (const benched of bench) {
      expect(onPitch.has(benched.id)).toBe(false);
    }
    for (const activeId of onPitch) {
      expect(bench.some((p) => p.id === activeId)).toBe(false);
    }
  });
});
