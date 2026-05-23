import path from "node:path";

const DEFAULT_RUNTIME_DATA_DIR = "/tmp/tactical-lab-3d";

export function writableDataPath(relativePath: string) {
  const configuredDataDir = process.env.TACTICAL_LAB_DATA_DIR;

  if (configuredDataDir) {
    return path.join(configuredDataDir, relativePath);
  }

  if (process.env.VERCEL) {
    return path.join(DEFAULT_RUNTIME_DATA_DIR, relativePath);
  }

  return relativePath;
}
