type ExportFormat = "mp4" | "gif";

const CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js";
const WASM_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm";
const WORKER_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.worker.js";

type ExportPhase = "recording" | "encoding";

export async function exportCanvasMedia(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  seconds = 5,
  onPhase?: (phase: ExportPhase) => void,
) {
  onPhase?.("recording");
  const webm = await recordCanvas(canvas, seconds);
  onPhase?.("encoding");
  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    await (ffmpeg as any).load({ coreURL: CORE_URL, wasmURL: WASM_URL, workerURL: WORKER_URL });
    await (ffmpeg as any).writeFile("input.webm", await fetchFile(webm));

    if (format === "mp4") {
      await (ffmpeg as any).exec(["-i", "input.webm", "-c:v", "libx264", "-pix_fmt", "yuv420p", "output.mp4"]);
      const data = (await (ffmpeg as any).readFile("output.mp4")) as Uint8Array;
      downloadBlob(new Blob([toArrayBuffer(data)], { type: "video/mp4" }), "romboiq-scene.mp4");
      return;
    }

    await (ffmpeg as any).exec([
      "-i",
      "input.webm",
      "-vf",
      "fps=10,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
      "output.gif",
    ]);
    const data = (await (ffmpeg as any).readFile("output.gif")) as Uint8Array;
    downloadBlob(new Blob([toArrayBuffer(data)], { type: "image/gif" }), "romboiq-scene.gif");
  } catch {
    downloadBlob(webm, "romboiq-scene.webm");
  }
}

export async function exportCanvasImage(
  canvas: HTMLCanvasElement,
  filename: string,
) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/png"),
  );
  if (!blob) throw new Error("No se pudo generar la imagen del visor.");
  downloadBlob(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
}

const SVG_EXPORT_STYLE_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "color",
] as const;

/**
 * Exports a live SVG element (e.g. a Quick Sketch surface) as a PNG image.
 * Quick Sketch styles its shapes via CSS classes from theme.css, which are
 * not available to a detached/serialized SVG, so this clones the node and
 * inlines the computed styles before rasterizing through an offscreen canvas.
 */
export async function exportSvgImage(
  svg: SVGSVGElement,
  filename: string,
  options?: { background?: string; scale?: number },
) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedSvgStyles(svg, clone);

  const viewBox = svg.viewBox.baseVal;
  const width = viewBox && viewBox.width ? viewBox.width : svg.clientWidth || 800;
  const height = viewBox && viewBox.height ? viewBox.height : svg.clientHeight || 512;
  const scale = options?.scale ?? 6;

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar el lienzo de exportacion.");
    if (options?.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/png"),
    );
    if (!blob) throw new Error("No se pudo generar la imagen del boceto.");
    downloadBlob(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function inlineComputedSvgStyles(source: Element, target: Element) {
  if (source instanceof SVGElement && target instanceof SVGElement) {
    const computed = window.getComputedStyle(source);
    let styleText = "";
    for (const prop of SVG_EXPORT_STYLE_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value) styleText += `${prop}:${value};`;
    }
    if (styleText) target.setAttribute("style", styleText);
  }
  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index];
    if (targetChild) inlineComputedSvgStyles(child, targetChild);
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar el boceto para exportar."));
    image.src = url;
  });
}

async function recordCanvas(canvas: HTMLCanvasElement, seconds: number) {
  const stream = canvas.captureStream(30);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  const done = new Promise<Blob>((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  recorder.start();
  await delay(seconds * 1000);
  recorder.stop();
  return done;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
