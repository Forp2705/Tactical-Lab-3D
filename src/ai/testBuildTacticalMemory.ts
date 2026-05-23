import { addMatchObservation } from "./addMatchObservation"
import { buildTacticalMemory } from "./buildTacticalMemory"

addMatchObservation({
  matchId: "vs-reserva-001",
  minute: 12,
  phase: "defensive-transition",
  observation:
    "Los delanteros retroceden rápido y el bloque se hunde.",
  severity: "high",
  tags: ["strikers", "block", "compactness"],
})

addMatchObservation({
  matchId: "vs-reserva-001",
  minute: 34,
  phase: "defensive-transition",
  observation:
    "Otra vez los delanteros bajan antes de presionar y el equipo termina cerca del área.",
  severity: "high",
  tags: ["strikers", "pressing", "block"],
})

addMatchObservation({
  matchId: "vs-reserva-001",
  minute: 51,
  phase: "build-up",
  observation:
    "El doble 5 queda muy separado cuando intentamos salir jugando.",
  severity: "medium",
  tags: ["midfield", "build-up", "spacing"],
})

async function test() {
  const memory = await buildTacticalMemory()

  console.log(JSON.stringify(memory, null, 2))
}

test()