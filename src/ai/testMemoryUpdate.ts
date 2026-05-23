import { updateMatchMemory } from "./updateMatchMemory"

async function test() {
  const updatedMemory =
    await updateMatchMemory()

  console.log("\nUPDATED MEMORY:\n")

  console.log(updatedMemory)
}

test()