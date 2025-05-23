import "./setup-fetch-mock"

// Test project: All addons working together
import { z } from "zod"
import { blueprint } from "./index"
import { reactAddon } from "./addons/react"
import { requestAddon } from "./addons/request"
import { swrAddon } from "./addons/swr"
// nextAddon is for Next.js API routes, which we can only mock here

// 1. Define a simple async blueprint
const EchoProps = z.object({ message: z.string() })
type EchoProps = z.infer<typeof EchoProps>
const EchoResult = z.object({ echoed: z.string() })
type EchoResult = z.infer<typeof EchoResult>

const echoBlueprint = blueprint<EchoProps, EchoResult>({
  propsSchema: EchoProps,
  resultSchema: EchoResult,
  description: "Echo Service"
}).setImplementation(async (props) => {
  return { echoed: `Echo: ${props.message}` }
})

// 2. Add requestAddon (expose as fetchable endpoint)
const echoRequestBP = echoBlueprint.addon(requestAddon()).request(
  "https://example.com/api/echo", // fake URL for demo
  EchoResult
)

// 3. Add reactAddon (provide React hook)
const echoReactBP = echoBlueprint.addon(reactAddon())
// Usage in React (pseudo-code):
// const useEcho = echoReactBP.hook()
// const { loading, error, result, trigger } = useEcho()

// 4. Add swrAddon (provide SWR mutation hook)
const echoSWRBP = echoBlueprint.addon(swrAddon())
// Usage in React (pseudo-code):
// const useEchoMutation = echoSWRBP.requestHook("/api/echo", EchoResult)
// const { trigger, data, error, isMutating } = useEchoMutation()

// 5. Compose all together
const composed = echoBlueprint
  .addon(requestAddon())
  .addon(reactAddon())
  .addon(swrAddon())

// --- Test calls ---
async function runAllAddonTests() {
  console.log("\n--- Direct Blueprint Call ---")
  const direct = await echoBlueprint({ message: "Hello" })
  console.log(direct)

  console.log("\n--- RequestAddon Simulated Call ---")
  const reqResult = await echoRequestBP({ url: "https://example.com/api/echo", body: { message: "Hi" } })
  console.log(reqResult)

  // React and SWR usage would be in a React component, so we just show the API:
  console.log("\n--- ReactAddon API ---")
  const reactApi = echoReactBP.hook
  console.log("React hook available:", typeof reactApi === "function")

  console.log("\n--- SWRAddon API ---")
  const swrApi = echoSWRBP.requestHook
  console.log("SWR hook available:", typeof swrApi === "function")
}

runAllAddonTests()

// For Next.js, you would use nextAddon to create a route handler:
// import { nextAddon } from "./addons/next"
// const echoNextBP = echoBlueprint.addon(nextAddon()).route()
// export const POST = echoNextBP // in a Next.js /app/api/echo/route.ts file

// This file demonstrates all addon APIs and their composition.
