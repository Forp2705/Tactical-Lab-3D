import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardia de arquitectura: el código de cliente (todo lo alcanzable por imports
 * estáticos desde src/main.tsx) NUNCA debe importar módulos server-only.
 *
 * Un módulo se considera server-only si usa builtins de Node (node:fs, node:path,
 * etc.). Esto cubre la regla del CLAUDE.md: "No importar CoachAgent.ts en React"
 * y evita filtrar la capa de knowledge/memory/post-match al bundle del cliente.
 *
 * El test descubre los archivos server-only solo, así que no hay que mantener
 * una lista a mano.
 */

const SRC = resolve(__dirname, "../src");
const ENTRY = join(SRC, "main.tsx");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Resuelve un specifier a una ruta de archivo absoluta dentro de src. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = join(SRC, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = resolve(dirname(fromFile), spec);
  } else {
    return null; // dependencia de node_modules: irrelevante para este guardia
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  // Permitimos specifiers con extensión .js que mapean a fuentes .ts
  if (base.endsWith(".js")) {
    candidates.push(base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"));
  }
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Imports estáticos de runtime (ignora `import type` puro). */
function staticRuntimeImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs: string[] = [];
  const importRe = /import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: patrón estándar de regex
  while ((m = importRe.exec(src)) !== null) {
    const isTypeOnly = Boolean(m[1]);
    if (!isTypeOnly) specs.push(m[2]);
  }
  return specs;
}

function isServerOnly(file: string): boolean {
  const src = readFileSync(file, "utf8");
  return /from\s+["']node:|require\(["'](?:fs|path|os|crypto|child_process)["']\)/.test(
    src,
  );
}

describe("AI layer boundary", () => {
  it("el grafo de cliente no importa módulos server-only", () => {
    // 1. clasificar todos los archivos
    const all = listSourceFiles(SRC);
    const serverOnly = new Set(all.filter(isServerOnly));

    // 2. BFS desde el entrypoint siguiendo solo imports estáticos de runtime
    const clientGraph = new Set<string>();
    const queue = [ENTRY];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (clientGraph.has(file)) continue;
      clientGraph.add(file);
      for (const spec of staticRuntimeImports(file)) {
        const resolved = resolveSpecifier(file, spec);
        if (resolved && !clientGraph.has(resolved)) queue.push(resolved);
      }
    }

    // 3. ningún archivo del cliente debe ser server-only
    const violations = [...clientGraph].filter((f) => serverOnly.has(f));
    expect(violations, `Server-only en el bundle de cliente:\n${violations.join("\n")}`).toEqual([]);
  });

  it("CoachAgent.ts no está en el grafo de cliente", () => {
    const clientGraph = new Set<string>();
    const queue = [ENTRY];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (clientGraph.has(file)) continue;
      clientGraph.add(file);
      for (const spec of staticRuntimeImports(file)) {
        const resolved = resolveSpecifier(file, spec);
        if (resolved && !clientGraph.has(resolved)) queue.push(resolved);
      }
    }
    const coachAgent = join(SRC, "ai/CoachAgent.ts");
    expect(clientGraph.has(coachAgent)).toBe(false);
  });
});
