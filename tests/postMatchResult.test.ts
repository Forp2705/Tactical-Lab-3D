import { describe, expect, it } from "vitest";
import { parseOwnPerspectiveResult } from "../src/ai/post-match/generatePostMatchReport";

describe("parseOwnPerspectiveResult", () => {
  it("interprets 5-0 as own-team win", () => {
    expect(parseOwnPerspectiveResult("5-0")).toEqual({
      ownGoals: 5,
      rivalGoals: 0,
      outcome: "win",
      label: "victoria propia 5 a 0",
    });
  });

  it("interprets 0-5 as own-team loss", () => {
    expect(parseOwnPerspectiveResult("0-5")?.outcome).toBe("loss");
  });

  it("interprets 2-2 as draw", () => {
    expect(parseOwnPerspectiveResult("2-2")?.outcome).toBe("draw");
  });
});
