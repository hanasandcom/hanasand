import WebSocket from 'ws'
import { configureLocalSmokeEnvironment } from './environment.ts'
import { startLocalTarget } from './localTarget.ts'
import { type BrokerPayload } from './payload.ts'
import { runBrokerScenario } from './scenario.ts'

export async function runOnionSessionBrokerSmoke() {
    configureLocalSmokeEnvironment()
    const { handleOnionSessionSocket } = await import('../../src/handlers/onionSession/ws.ts')
    const server = await startLocalTarget(handleOnionSessionSocket)
    let client: WebSocket | undefined
    try {
        client = new WebSocket(server.socketUrl)
        const payloads: BrokerPayload[] = []
        client.on('message', message => {
            try {
                payloads.push(JSON.parse(message.toString()) as BrokerPayload)
            } catch {
                payloads.push({ type: 'unparseable', text: message.toString() })
            }
        })
        await onceOpen(client)
        await runBrokerScenario(client, server.target, payloads)
        console.log(JSON.stringify({
            ok: true,
            target: server.target,
            receivedFrames: payloads.filter(payload => payload.type === 'frame').length,
            receivedConsoleEvents: payloads.filter(payload => payload.type === 'console').map(payload => payload.text),
        }, null, 2))
    } finally {
        client?.terminate()
        await server.close()
    }
}

function onceOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve())
        socket.once('error', reject)
    })
}
