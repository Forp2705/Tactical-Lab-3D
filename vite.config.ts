import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

type ApiHandlerModule = {
  default: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => void | Promise<void>;
};

function localApiRoute(
  pathname: string,
  loadHandler: () => Promise<ApiHandlerModule>,
): Plugin {
  return {
    name: `local-api:${pathname}`,
    configureServer(server) {
      server.middlewares.use(pathname, async (req, res, next) => {
        try {
          const module = await loadHandler();
          await module.default(req, res);
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
}

export default defineConfig(() => ({
  plugins: [
    react(),
    localApiRoute("/api/agent-status", () => import("./api/agent-status")),
    localApiRoute("/api/coach-agent", () => import("./api/coach-agent")),
    localApiRoute("/api/coach-feedback", () => import("./api/coach-feedback")),
    localApiRoute("/api/coach-observability", () =>
      import("./api/coach-observability"),
    ),
    localApiRoute("/api/ai/gemini", () => import("./api/ai/gemini")),
    localApiRoute("/api/post-match/generate", () =>
      import("./api/post-match/generate"),
    ),
    localApiRoute("/api/post-match/reports", () =>
      import("./api/post-match/reports"),
    ),
    localApiRoute("/api/post-match/memory", () =>
      import("./api/post-match/memory"),
    ),
    localApiRoute("/api/video/pattern-scan", () =>
      import("./api/video/pattern-scan"),
    ),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separamos las dependencias pesadas en vendor chunks con nombre
        // propio. Mejora el cacheo entre deploys y hace honesto el reporte de
        // tamano (antes "three" caia dentro de un chunk llamado Pitch3D).
        // No cambia el lazy-loading: estos paquetes solo los importan vistas
        // que ya se cargan bajo demanda.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/three/") ||
            id.includes("@react-three") ||
            id.includes("postprocessing")
          ) {
            return "three-vendor";
          }
          if (id.includes("@react-pdf") || id.includes("react-pdf")) {
            return "pdf-vendor";
          }
          if (id.includes("@ffmpeg")) {
            return "ffmpeg-vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
