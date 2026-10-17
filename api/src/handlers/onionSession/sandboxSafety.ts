import { lookup } from 'node:dns/promises'
import { allowLocalSandboxTargets } from './browserRuntime.ts'
import { sandboxUrlSafety } from './analysis.ts'

export async function sandboxRequestSafety(value: string) {
    const literalSafety = sandboxUrlSafety(value, { allowLocalTargets: allowLocalSandboxTargets() })
    if (!literalSafety.ok || allowLocalSandboxTargets()) return literalSafety
    let host: string
    try {
        host = new URL(value).hostname.replace(/^\[|\]$/g, '').toLowerCase()
    } catch {
        return literalSafety
    }
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return literalSafety
    return lookup(host, { all: true })
        .then(sandboxResolvedAddressSafety)
        .catch(() => ({ ok: false as const, reason: 'hostname could not be resolved safely' }))
}

export function sandboxResolvedAddressSafety(addresses: Array<{ address: string; family: number }>) {
    if (!addresses.length) return { ok: false as const, reason: 'hostname did not resolve to an address' }
    for (const item of addresses) {
        const addressUrl = item.family === 6 ? `http://[${item.address}]/` : `http://${item.address}/`
        const safety = sandboxUrlSafety(addressUrl)
        if (!safety.ok) return { ok: false as const, reason: `hostname resolves to ${safety.reason}` }
    }
    return { ok: true as const }
}

