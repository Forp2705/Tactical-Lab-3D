import { auditCatalog } from "../src/data/exercises/validatedCatalog.js";

// Reporte de calidad deterministico del catalogo de ejercicios.
// Uso: npm run exercises:audit
// No usa LLM ni red: solo corre validateExercise sobre el catalogo.

function main() {
  const limit = Number(process.argv[2] ?? 5);
  const audit = auditCatalog(undefined, Number.isFinite(limit) ? limit : 5);

  const lines: string[] = [];
  lines.push("=== RomboIQ — Exercise Quality Report ===");
  lines.push(
    `total ${audit.total} | criticos ${audit.criticalCount} | score promedio ${audit.averageScore}`,
  );
  lines.push("");
  lines.push("Problemas por tag:");
  for (const [tag, count] of Object.entries(audit.byTag).sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`  ${String(count).padStart(3)}  ${tag}`);
  }
  lines.push("");
  lines.push(`Top ${audit.worst.length} a corregir:`);
  for (const entry of audit.worst) {
    lines.push(
      `  ${String(entry.score).padStart(3)} ${entry.critical ? "CRIT" : "    "} ${
        entry.generated ? "[gen] " : "[hand]"
      } ${entry.exerciseId.padEnd(34)} [${entry.domains.join(",")}] ${entry.tags.join(",")}`,
    );
  }
  lines.push("");
  lines.push("Todos (peores primero):");
  for (const entry of audit.entries) {
    lines.push(
      `  ${String(entry.score).padStart(3)} ${entry.critical ? "CRIT" : "    "} ${entry.exerciseId}`,
    );
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

main();
