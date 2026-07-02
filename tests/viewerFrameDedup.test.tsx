import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/data";
import { useAppStore } from "../src/state/useAppStore";
import { ViewerCanvasHud } from "../src/viewer/ViewerCanvasHud";
import { type MatchFrame, getMatchFrame } from "../src/viewer/lib/matchEngine";

// PR-A dedup: el match engine se computa UNA vez en ViewerWorkspace y se
// inyecta a Scene3D y al HUD. Antes cada uno llamaba getMatchFrame por su
// cuenta -> 2x por frame durante playback.
//
// Este test verifica el lado HUD de forma honesta y headless-safe (no hay DOM
// env; el HUD es DOM puro, rendereable con renderToStaticMarkup): el HUD ahora
// es consumidor puro del frame que recibe por prop. Inyectamos un frame con un
// trigger centinela; si el HUD volviera a auto-computar su propio frame, el
// centinela NO apareceria (el frame real no lo tiene) y el test fallaria.
//
// Nota: no asertamos "una sola llamada en total" (daria verde por el motivo
// equivocado: el engine DEBE recalcular al avanzar el time). Asertamos que el
// HUD refleja el frame inyectado en cada time -> su aporte al engine paso de
// 1/frame a 0/frame. El segundo call-site (Scene3D) quedo eliminado por la
// remocion del import de getMatchFrame (lo confirma type-check + Biome).

const SENTINEL = "SENAL_CENTINELA_DESDE_PROP";
const exercise = catalog[0];
const layers = useAppStore.getInitialState().layers;

function frameWithSentinelTrigger(time: number): MatchFrame {
  const base = getMatchFrame(exercise, time, { personalSpace: false });
  return {
    ...base,
    triggers: [
      {
        id: "t-sentinel",
        description: SENTINEL,
        whenT: 0,
        cause: { actorId: "x", action: "backPass" },
        activatesOverlays: [],
      },
    ],
  };
}

function renderHud(time: number) {
  return renderToStaticMarkup(
    <ViewerCanvasHud
      exercise={exercise}
      time={time}
      cameraMode="iso"
      showZones
      showRuns
      showPasses
      showPress
      layers={layers}
      frame={frameWithSentinelTrigger(time)}
    />,
  );
}

describe("viewer match-frame dedup (PR-A)", () => {
  it("HUD renders from the injected frame prop, not a self-computed one", () => {
    expect(renderHud(0)).toContain(SENTINEL);
  });

  it("reflects the injected frame on every time change (pure consumer)", () => {
    for (const time of [0, 1, 2]) {
      expect(renderHud(time)).toContain(SENTINEL);
    }
  });
});
