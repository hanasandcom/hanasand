import { lookup } from 'node:dns/promises'
import { allowLocalSandboxTargets } from './browserRuntime.ts'
import { sandboxUrlSafety } from './analysis.ts'

type SandboxHostnameResolver = (hostname: string, options: { all: true }) => Promise<Array<{ address: string; family: number }>>

export async function sandboxRequestSafety(value: string, network: 'tor' | 'regular' = 'regular', resolveHost: SandboxHostnameResolver = lookup) {
    const literalSafety = sandboxUrlSafety(value, { allowLocalTargets: allowLocalSandboxTargets() })
    if (!literalSafety.ok) return literalSafety
    let host: string
    try {
        host = new URL(value).hostname.replace(/^\[|\]$/g, '').toLowerCase()
    } catch {
        return literalSafety
    }
    if (host.endsWith('.onion')) {
        return network === 'tor' ? literalSafety : { ok: false as const, reason: 'onion addresses require Tor routing' }
    }
    if (allowLocalSandboxTargets()) return literalSafety
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return literalSafety
    return resolveHost(host, { all: true })
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
