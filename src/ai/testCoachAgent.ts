import { generateCoachResponse } from "./CoachAgent"
import { TACTICAL_TEST_CASES } from "./TestCases"

async function test() {
  for (const testCase of TACTICAL_TEST_CASES) {
    console.log("\n==============================")
    console.log(`CASE: ${testCase.name}`)
    console.log("==============================\n")

    const response = await generateCoachResponse(testCase.input)

    console.log(JSON.stringify(response, null, 2))
  }
}

test()