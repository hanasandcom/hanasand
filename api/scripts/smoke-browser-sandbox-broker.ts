import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import WebSocket, { WebSocketServer } from 'ws'
import { chromium } from 'playwright'
import { assertFrameEvidence, assertProviderCaptures } from './smoke-browser-sandbox-broker/assertions.ts'
import { createFixtureServer, downloadBody, downloadHash, payloadDomain } from './smoke-browser-sandbox-broker/fixtures.ts'
import { listen, onceListening, onceOpen, portFor, waitForPayload } from './smoke-browser-sandbox-broker/support.ts'
import type { BrokerPayload } from './smoke-browser-sandbox-broker/types.ts'

// Exercise the isolated worker; admission and entitlements are tested at the broker.
process.env.BROWSER_SANDBOX_SKIP_RUN_DB = '1'
process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS = '1'
const chromiumCandidate = [
    process.env.CHROMIUM_BIN || '',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    chromium.executablePath(),
    ...cachedChromiumCandidates(),
].find(candidate => candidate && existsSync(candidate))
if (chromiumCandidate) process.env.CHROMIUM_BIN = chromiumCandidate

const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
const { extractThreatAssociations } = await import('../src/handlers/onionSession/analysis.ts')

const httpServer = createFixtureServer()
await listen(httpServer)
const httpPort = portFor(httpServer)
const base = `http://127.0.0.1:${httpPort}`
const target = `${base}/start`

assert.deepEqual(extractThreatAssociations('Vidar (26) våknet med nytt navn i en nyhetssak.', 'rendered_page'), [], 'does not treat benign person-name Vidar as malware context')
assert.equal(extractThreatAssociations('Vidar malware family detected stealing browser credentials.', 'rendered_page')[0]?.name, 'Vidar', 'keeps explicit Vidar malware context')

const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 })
await onceListening(wsServer)
const wsPort = portFor(wsServer)

wsServer.on('connection', connection => {
    handleOnionSessionSocket(connection, `browser-sandbox-smoke-${Date.now().toString(36)}`, 'regular')
})

const client = new WebSocket(`ws://127.0.0.1:${wsPort}`)
const payloads: BrokerPayload[] = []

client.on('message', message => {
    try {
        payloads.push({ ...JSON.parse(message.toString()) as BrokerPayload, receivedAt: Date.now() })
    } catch {
        payloads.push({ type: 'unparseable', receivedAt: Date.now() })
    }
})

await onceOpen(client)
client.send(JSON.stringify({
    type: 'start',
    target,
    durationMinutes: 1,
    width: 960,
    height: 540,
    profileTools: [
        { id: 'virustotal', name: 'VirusTotal', url: `${base}/virustotal?url={url}` },
        { id: 'urlquery', name: 'urlquery', url: `${base}/urlquery?q={url}` },
        { id: 'webcrack', name: 'WebCrack', url: `${base}/webcrack` },
    ],
}))

await waitForPayload(payloads, payload => payload.type === 'ready')
await waitForPayload(payloads, payload => payload.type === 'frame' && Boolean(payload.image) && payload.url?.endsWith('/start'))
client.send(JSON.stringify({ type: 'click', x: 80, y: 48, button: 0 }))
const clickStarted = Date.now()
const clickFrame = await waitForPayload(payloads, payload => payload.type === 'frame' && payload.reason === 'interaction' && payload.title === 'Interactive click received', 2_000)
assert((clickFrame.receivedAt || Date.now()) - clickStarted < 1500, 'Click feedback must not wait for a navigation or heavy evidence capture')
client.send(JSON.stringify({ type: 'click', x: 80, y: 108, button: 0 }))
for (const key of 'abc') client.send(JSON.stringify({ type: 'key', key }))
await waitForPayload(payloads, payload => payload.type === 'frame' && payload.title === 'Typed proof: abc', 8_000)
client.send(JSON.stringify({ type: 'click', x: 80, y: 155, button: 0 }))
await waitForPayload(payloads, payload => payload.type === 'downloads' && Boolean(payload.networkSummary?.downloads?.some(file => file.sha256 === downloadHash)), 8_000)
await waitForPayload(payloads, payload => payload.type === 'frame' && payload.url?.endsWith('/final'), 25_000)
await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'virustotal' && payload.toolAnalysis.vendorFlagged !== undefined)
await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'urlquery' && payload.toolAnalysis.alertCount !== undefined)
await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.toolAnalysis?.toolKind === 'webcrack' && payload.webcrackLoad?.loaded === true)
assert(payloads.some(payload => payload.type === 'tool_capture' && payload.error === 'provider_navigation_pending'), 'provider tabs surface a pending capture immediately')
const targetLog = payloads.find(payload => payload.type === 'console' && payload.text === 'Target startup welcome')
assert.equal(targetLog?.source, 'target')
assert.equal(targetLog?.tabId, 'browser')
assert.equal(targetLog?.level, 'log')
assert(targetLog?.url?.endsWith('/start') && targetLog.line, 'Target console retains its original source and line')
assert(payloads.some(payload => payload.type === 'console' && payload.text === 'Provider diagnostic only' && payload.source === 'provider' && payload.tabId === 'virustotal'), 'Provider diagnostics are explicitly separated')
assert(!payloads.some(payload => payload.type === 'status' && payload.state === 'tab_selected' && payload.tabId !== 'browser'), 'Automatic checks must not select a provider tab for the user')
const suspiciousTiming = await waitForPayload(payloads, payload => payload.type === 'run_time' && payload.suspiciousExtended === true)
assert(new Date(suspiciousTiming.expiresAt || 0).getTime() - (suspiciousTiming.receivedAt || 0) > 120_000, 'suspicious evidence extends the live run to about three minutes')
client.send(JSON.stringify({ type: 'select_tab', tabId: 'virustotal' }))
await waitForPayload(payloads, payload => payload.type === 'status' && payload.state === 'tab_selected' && payload.url?.includes('/virustotal'))
client.send(JSON.stringify({ type: 'extend', extension: 'free' }))
await waitForPayload(payloads, payload => payload.type === 'run_time' && payload.freeExtensionUsed === true)
client.send(JSON.stringify({ type: 'extend', extension: 'free' }))
await waitForPayload(payloads, payload => payload.type === 'status' && payload.state === 'extension_used')
client.send(JSON.stringify({ type: 'extend', extension: 'paid' }))
await waitForPayload(payloads, payload => payload.type === 'status' && payload.state === 'payment_required')

const ready = payloads.find(payload => payload.type === 'ready')
const pageFrames = payloads.filter(payload => payload.type === 'frame')
assert.equal(ready?.torProxyConfigured, false, 'regular browser sandbox should not use the Tor proxy')
assertFrameEvidence(pageFrames, payloadDomain, downloadBody, downloadHash)
assertProviderCaptures(payloads, ready)

client.send(JSON.stringify({ type: 'end' }))
await waitForPayload(payloads, payload => payload.type === 'ended')
client.close()
wsServer.close()
httpServer.close()

console.log(JSON.stringify({
    ok: true,
    target,
    pageUrls: Array.from(new Set(pageFrames.map(payload => payload.url).filter(Boolean))),
    pageCaptureCount: pageFrames.length,
    clickFeedbackMs: (clickFrame.receivedAt || 0) - clickStarted,
    toolCaptures: payloads.filter(payload => payload.type === 'tool_capture').map(payload => payload.toolAnalysis?.toolKind),
}, null, 2))
process.exit(0)

function cachedChromiumCandidates() {
    const cacheRoot = path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
    try {
        return readdirSync(cacheRoot, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name.startsWith('chromium_headless_shell-'))
            .map(entry => path.join(cacheRoot, entry.name, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
    } catch {
        return []
    }
}
