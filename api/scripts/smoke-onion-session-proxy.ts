import assert from 'node:assert/strict'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import { chromium } from 'playwright'
import { handleOnionSessionSocket } from '../src/handlers/onionSession/ws.ts'
import { createSocksServer, type SocksConnect } from './smoke-onion-session-proxy-socks-fixture.ts'

type BrokerPayload = {
    type?: string
    message?: string
    torProxyConfigured?: boolean
    target?: string
}

const targetHost = 'p53lf57qbcph367w7g4i57ctv7hlfssgmqb6e6g3m7654g6wb27w36yd.onion'
const proxyTargetBody = '<!doctype html><title>Proxy smoke target</title><main>Loaded through ONION_SESSION_PROXY</main>'
const socksConnects: SocksConnect[] = []
const socksServer = createSocksServer(targetHost, proxyTargetBody, socksConnects)

await listen(socksServer)
const socksPort = portFor(socksServer)

process.env.ONION_SESSION_PROXY = `socks5://127.0.0.1:${socksPort}`
delete process.env.TOR_SOCKS_PROXY
process.env.CHROMIUM_BIN ||= chromium.executablePath()

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await onceListening(wsServer)
const wsPort = portFor(wsServer)

wsServer.on('connection', (connection) => {
    handleOnionSessionSocket(connection, `proxy-smoke-${Date.now().toString(36)}`)
})

const client = new WebSocket(`ws://127.0.0.1:${wsPort}`)
const payloads: BrokerPayload[] = []
client.on('message', (message) => {
    try {
        payloads.push(JSON.parse(message.toString()) as BrokerPayload)
    } catch {
        payloads.push({ type: 'unparseable', message: message.toString() })
    }
})

await onceOpen(client)
client.send(JSON.stringify({
    type: 'start',
    target: `http://${targetHost}/?probe=onion-socks-routing`,
    network: 'tor',
    durationMinutes: 1,
    width: 900,
    height: 540,
}))

await waitForPayload(payloads, (payload) => payload.type === 'status' && payload.torProxyConfigured === true)
await waitFor(() => socksConnects.some((connect) => connect.host === targetHost && connect.port === 80))
await waitForPayload(payloads, (payload) => payload.type === 'ready' && payload.torProxyConfigured === true)

client.send(JSON.stringify({ type: 'end' }))
await waitForPayload(payloads, (payload) => payload.type === 'ended').catch(() => undefined)
client.close()
wsServer.close()
socksServer.close()

const requested = socksConnects.map((connect) => `${connect.host}:${connect.port}`)
assert(requested.includes(`${targetHost}:80`), `expected Chromium to route target navigation through SOCKS proxy, got ${requested.join(', ')}`)

console.log(JSON.stringify({
    ok: true,
    proxy: process.env.ONION_SESSION_PROXY,
    socksConnects: requested,
    brokerStates: payloads.filter((payload) => payload.type === 'status' || payload.type === 'navigation_error').map((payload) => payload.message || payload.target || payload.type),
}, null, 2))

function listen(server: net.Server) {
    return new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => resolve())
    })
}

function onceListening(server: WebSocketServer) {
    return new Promise<void>((resolve) => {
        if (server.address()) {
            resolve()
            return
        }
        server.once('listening', () => resolve())
    })
}

function onceOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve())
        socket.once('error', reject)
    })
}

function portFor(server: net.Server | WebSocketServer) {
    const address = server.address()
    assert(address && typeof address !== 'string')
    return (address as AddressInfo).port
}

function waitFor(predicate: () => boolean, timeoutMs = 20_000) {
    const started = Date.now()

    return new Promise<void>((resolve, reject) => {
        const timer = setInterval(() => {
            if (predicate()) {
                clearInterval(timer)
                resolve()
                return
            }

            if (Date.now() - started > timeoutMs) {
                clearInterval(timer)
                reject(new Error('Timed out waiting for SOCKS proxy connection'))
            }
        }, 50)
    })
}

function waitForPayload(payloads: BrokerPayload[], predicate: (payload: BrokerPayload) => boolean, timeoutMs = 20_000) {
    const started = Date.now()

    return new Promise<BrokerPayload>((resolve, reject) => {
        const timer = setInterval(() => {
            const match = payloads.find(predicate)
            if (match) {
                clearInterval(timer)
                resolve(match)
                return
            }

            if (Date.now() - started > timeoutMs) {
                clearInterval(timer)
                reject(new Error(`Timed out waiting for broker payload. Received: ${JSON.stringify(payloads.slice(-8))}`))
            }
        }, 50)
    })
}
