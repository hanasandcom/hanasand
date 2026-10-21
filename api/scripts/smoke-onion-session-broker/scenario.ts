import assert from 'node:assert/strict'
import type WebSocket from 'ws'
import { downloadHash } from './localTarget.ts'
import { type BrokerPayload, waitForPayload } from './payload.ts'

export async function runBrokerScenario(client: WebSocket, target: string, payloads: BrokerPayload[]) {
    client.send(JSON.stringify({
        type: 'start', target, durationMinutes: 1, width: 900, height: 540,
        profileTools: [{ id: 'smoke-provider', name: 'Sandbox provider smoke', url: new URL('provider', target).href }],
    }))

    await waitForPayload(payloads, payload => payload.type === 'ready')
    const firstFrame = await waitForPayload(payloads, payload => payload.type === 'frame' && Boolean(payload.image))
    assert((firstFrame.image || '').length > 1000, 'expected a non-empty streamed JPEG frame')
    assert.equal(payloads.find(payload => payload.type === 'ready')?.torProxyConfigured, false)

    client.send(JSON.stringify({ type: 'key', key: 'h' }))
    client.send(JSON.stringify({ type: 'key', key: 'i' }))
    await waitForPayload(payloads, payload => payload.type === 'console' && payload.text === 'input:hi')

    client.send(JSON.stringify({ type: 'click', x: 186, y: 132, button: 0 }))
    await waitForPayload(payloads, payload => payload.type === 'console' && payload.text === 'button-clicked')
    client.send(JSON.stringify({ type: 'wheel', x: 420, y: 260, deltaY: 280 }))
    await waitForPayload(payloads, payload => payload.type === 'console' && /^wheel:\d+/.test(payload.text || ''))

    const providerCapture = await waitForPayload(payloads, payload => payload.type === 'tool_capture' && payload.id === 'smoke-provider' && Boolean(payload.image))
    assert(providerCapture.image, 'expected the isolated provider browser to return a screenshot in the existing capture event')
    assert(!payloads.some(payload => payload.type === 'status' && ['tab_selected', 'tab_navigated'].includes(payload.state || '')), 'provider capture must not change the target browser tab')

    await verifyClipboard(client, payloads)
    await verifyDownload(client, payloads)
    client.send(JSON.stringify({ type: 'end' }))
    await waitForPayload(payloads, payload => payload.type === 'ended')
}

async function verifyClipboard(client: WebSocket, payloads: BrokerPayload[]) {
    client.send(JSON.stringify({ type: 'clipboard', text: 'clipboard-smoke' }))
    await waitForPayload(payloads, payload => payload.type === 'clipboard' && payload.ok === true)
    client.send(JSON.stringify({ type: 'click', x: 180, y: 52, button: 0 }))
    client.send(JSON.stringify({ type: 'key', key: 'v', ctrlKey: true }))
    await waitForPayload(payloads, payload => payload.type === 'console' && payload.text === 'input:hiclipboard-smoke')
    client.send(JSON.stringify({ type: 'click', x: 180, y: 52, button: 0 }))
    client.send(JSON.stringify({ type: 'key', key: 'a', ctrlKey: true }))
    client.send(JSON.stringify({ type: 'key', key: 'c', ctrlKey: true }))
    client.send(JSON.stringify({ type: 'clipboard', direction: 'remote-to-browser' }))
    await waitForPayload(payloads, payload => payload.type === 'clipboard' && payload.text === 'hiclipboard-smoke')
}

async function verifyDownload(client: WebSocket, payloads: BrokerPayload[]) {
    client.send(JSON.stringify({ type: 'click', x: 380, y: 132, button: 0 }))
    await waitForPayload(payloads, payload => payload.type === 'frame' && Boolean(payload.networkSummary?.downloads?.some(
        download => download.sha256 === downloadHash && download.fileName === 'sample.txt',
    )))
}
