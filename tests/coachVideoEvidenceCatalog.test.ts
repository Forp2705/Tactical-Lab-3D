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

  it("T4: una marca de ABP ajena a la consulta de salida NO entra al catalogo", () => {
    return retrieveCoachEvidence("no salimos limpio con el pivote bajo presion", {
      videoEvidence: {
        total: 1,
        tags: 1,
        manualTracks: 0,
        confirmedTracks: 0,
        assistedTracks: 0,
        text: "78:10 | corner rival | area chica | fuente: tag manual",
      },
    }).then((result) => {
      const anyVideo = result.evidenceCatalog.find(
        (item) => item.sourceType === "video",
      );
      expect(anyVideo).toBeUndefined();
    });
  });

  it("T4: una marca de salida SI entra cuando la consulta es de salida", async () => {
    const result = await retrieveCoachEvidence(
      "no salimos limpio, el pivote recibe de espaldas",
      {
        videoEvidence: {
          total: 1,
          tags: 1,
          manualTracks: 0,
          confirmedTracks: 0,
          assistedTracks: 0,
          text: "12:31 | pivote recibe de espaldas en salida | carril central | fuente: tag manual",
        },
      },
    );

    const video = result.evidenceCatalog.find(
      (item) => item.sourceType === "video",
    );
    expect(video).toBeDefined();
  });
});
