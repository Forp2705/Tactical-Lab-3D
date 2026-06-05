import { describe, expect, it } from "vitest";
import { retrieveCoachEvidence } from "../src/ai/CoachAgent";

describe("coach video evidence catalog", () => {
  it("convierte runtime video evidence en fuentes VID citables", async () => {
    const result = await retrieveCoachEvidence("bloque largo por dentro", {
      videoEvidence: {
        total: 1,
        tags: 1,
        manualTracks: 0,
        confirmedTracks: 0,
        assistedTracks: 0,
        text: "12:31 | bloque largo | carril central | fuente: tag manual",
      },
    });

    const video = result.evidenceCatalog.find((item) => item.id === "VID-1");
    expect(video).toMatchObject({
      sourceType: "video",
      title: "Tag manual 12:31",
    });
    expect(video?.evidenceTargets).toContain("moment");
    expect(video?.evidenceTargets).toContain("zone");
  });
});
