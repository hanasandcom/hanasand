import { runOnionSessionBrokerSmoke } from './smoke-onion-session-broker/run.ts'

runOnionSessionBrokerSmoke().catch((error) => {
    console.error((error as { details?: unknown } | null)?.details ?? error)
    process.exitCode = 1
})
