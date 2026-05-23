import { consolidateTacticalMemory } from "./consolidateTacticalMemory"

async function test() {
  const memory = [
    {
      category: "defensive-transition",
      pattern:
        "Los delanteros retroceden rápido antes de presionar",
      impact:
        "El bloque se hunde y el equipo pierde compactación",
      frequency: 2,
      severityScore: 0.8,
      lastSeen: "2026-05-22",
    },

    {
      category: "defensive-transition",
      pattern:
        "Los delanteros bajan antes de activar presión",
      impact:
        "El equipo termina defendiendo cerca del área",
      frequency: 3,
      severityScore: 0.9,
      lastSeen: "2026-05-22",
    },

    {
      category: "build-up",
      pattern:
        "El doble pivote queda demasiado separado",
      impact:
        "Se rompe la circulación interior",
      frequency: 1,
      severityScore: 0.5,
      lastSeen: "2026-05-22",
    },
  ]

  const consolidated =
    await consolidateTacticalMemory(memory)

  console.log(
    JSON.stringify(consolidated, null, 2)
  )
}

test()