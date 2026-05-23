import { extractTacticalKnowledge } from "./extractTacticalKnowledge"

async function test() {
  const sourceText = `
Cuando un equipo pierde la pelota, los primeros segundos son fundamentales.
Si el rival todavía no logró estabilizar la posesión,
la presión inmediata puede recuperar el balón en zonas avanzadas.

Sin embargo, si el bloque no acompaña la presión,
el equipo queda partido y expuesto a transiciones.
La distancia entre líneas debe mantenerse corta para sostener la presión.
`

  const knowledge =
    await extractTacticalKnowledge(sourceText)

  console.log(
    JSON.stringify(knowledge, null, 2)
  )
}

test()