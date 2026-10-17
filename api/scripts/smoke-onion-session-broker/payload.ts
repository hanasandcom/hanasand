import assert from 'node:assert/strict'

export type BrokerPayload = {
    type?: string
    state?: string
    text?: string
    image?: string
    ok?: boolean
    torProxyConfigured?: boolean
    networkSummary?: {
        downloads?: Array<{ sha256?: string; fileName?: string; bytes?: number; hashStatus?: string }>
    }
}

export function waitForPayload(
    payloads: BrokerPayload[],
    predicate: (payload: BrokerPayload) => boolean,
    timeoutMs = 20_000,
) {
    const started = Date.now()
    return new Promise<BrokerPayload>((resolve, reject) => {
        const timer = setInterval(() => {
            const match = payloads.find(predicate)
            if (match) {
                clearInterval(timer)
                resolve(match)
            } else if (Date.now() - started > timeoutMs) {
                clearInterval(timer)
                reject(new Error(`Timed out waiting for broker payload. Received: ${JSON.stringify(payloads.slice(-8).map(summarizePayload))}`))
            }
        }, 50)
    })
}

function summarizePayload(payload: BrokerPayload) {
    if (payload.type !== 'frame') return payload
    return { type: payload.type, imageBytes: payload.image?.length || 0 }
}

export function assertPort(address: string | import('node:net').AddressInfo | null) {
    assert(address && typeof address !== 'string')
    return address.port
}
