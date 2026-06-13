import { createBlankSketch, type Sketch } from "./sketchSchemas";

type BuildContextualSketchDraftOptions = {
  title?: string;
  tacticalFocus?: string;
  sourceLabel?: string;
};

function shorten(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}...`;
}

export function buildContextualSketchDraft(
  options?: BuildContextualSketchDraftOptions,
): Sketch {
  const sketch = createBlankSketch(options?.title);
  const labels = [
    options?.tacticalFocus?.trim()
      ? {
          id: "ctx-focus",
          x: 8,
          y: 8,
          text: shorten(options.tacticalFocus, 80),
        }
      : null,
    options?.sourceLabel?.trim()
      ? {
          id: "ctx-source",
          x: 8,
          y: 14,
          text: shorten(options.sourceLabel, 80),
        }
      : null,
  ].filter((label): label is NonNullable<typeof label> => Boolean(label));

  return {
    ...sketch,
    labels,
  };
}

export function buildQuickSketchTitle(parts: Array<string | null | undefined>) {
  const joined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" - ");
  return joined || "Boceto rapido";
}
