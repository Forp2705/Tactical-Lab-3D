import { useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import { QuickSketchView } from "./QuickSketchView";
import type { Sketch } from "./sketchSchemas";

type QuickSketchLauncherProps = {
  buildDraft: () => Sketch;
  buttonClassName?: string;
  buttonLabel: string;
  buttonTitle?: string;
  panelEyebrow?: string;
  panelTitle?: string;
  onSaveSuccess?: (sketchId: string) => void;
};

export function QuickSketchLauncher({
  buildDraft,
  buttonClassName,
  buttonLabel,
  buttonTitle,
  panelEyebrow = "Boceto rapido",
  panelTitle = "Explica la idea y guardala para la semana",
  onSaveSuccess,
}: QuickSketchLauncherProps) {
  const [draft, setDraft] = useState<Sketch | null>(null);

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        title={buttonTitle}
        onClick={() => setDraft(buildDraft())}
      >
        {buttonLabel}
      </button>
      {draft ? (
        <div className="quick-sketch-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="quick-sketch-modal-scrim"
            aria-label="Cerrar boceto rapido"
            onClick={() => setDraft(null)}
          />
          <div className="quick-sketch-modal-card">
            <div className="quick-sketch-modal-head">
              <div>
                <span className="panel-eyebrow">{panelEyebrow}</span>
                <h3>{panelTitle}</h3>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft(null)}
              >
                Cerrar
              </button>
            </div>
            <QuickSketchView
              sketch={draft}
              onCancel={() => setDraft(null)}
              onSave={(nextSketch) => {
                const sketchId = useAppStore
                  .getState()
                  .createSketch({ title: nextSketch.title });
                useAppStore.getState().updateSketch(sketchId, {
                  title: nextSketch.title,
                  version: nextSketch.version,
                  pitchOrientation: nextSketch.pitchOrientation,
                  tokens: nextSketch.tokens,
                  annotations: nextSketch.annotations,
                  labels: nextSketch.labels,
                  updatedAt: nextSketch.updatedAt,
                });
                onSaveSuccess?.(sketchId);
                setDraft(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
