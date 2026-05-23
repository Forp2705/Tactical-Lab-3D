import fs from "node:fs/promises"
import { extractTacticalKnowledge } from "./extractTacticalKnowledge"

const SOURCE_PATH = "src/ai/sources/pressing.txt"
const OUTPUT_PATH = "src/ai/knowledge/pressing.json"

function chunkText(text: string, maxChars = 3500) {
  const chunks: string[] = []

  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars))
  }

  return chunks
}

async function ingest() {
  const sourceText = await fs.readFile(SOURCE_PATH, "utf-8")
  const chunks = chunkText(sourceText)

  const allKnowledge = []

  for (const [index, chunk] of chunks.entries()) {
    console.log(`Processing chunk ${index + 1}/${chunks.length}`)

    const knowledge = await extractTacticalKnowledge(chunk)

    allKnowledge.push(...knowledge)
  }

  await fs.mkdir("src/ai/knowledge", { recursive: true })

  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(allKnowledge, null, 2),
    "utf-8"
  )

  console.log(`Saved ${allKnowledge.length} knowledge items to ${OUTPUT_PATH}`)
}

ingest()