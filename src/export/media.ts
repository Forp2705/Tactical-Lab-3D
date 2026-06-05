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
