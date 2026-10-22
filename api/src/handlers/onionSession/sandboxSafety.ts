import { lookup } from 'node:dns/promises'
import { createHash } from 'node:crypto'
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
        if (!isValidOnionV3Hostname(host.slice(0, -'.onion'.length))) {
            return { ok: false as const, reason: 'invalid v3 onion hostname checksum or version' }
        }
        return network === 'tor' ? literalSafety : { ok: false as const, reason: 'onion addresses require Tor routing' }
    }
    if (allowLocalSandboxTargets()) return literalSafety
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return literalSafety
    return resolveHost(host, { all: true })
        .then(sandboxResolvedAddressSafety)
        .catch(() => ({ ok: false as const, reason: 'hostname could not be resolved safely' }))
}

const onionBase32 = 'abcdefghijklmnopqrstuvwxyz234567'

export function isValidOnionV3Hostname(hostname: string) {
    if (!/^[a-z2-7]{56}$/i.test(hostname)) return false

    const decoded: number[] = []
    let buffer = 0
    let bits = 0
    for (const character of hostname.toLowerCase()) {
        const value = onionBase32.indexOf(character)
        if (value < 0) return false
        buffer = (buffer << 5) | value
        bits += 5
        if (bits >= 8) {
            bits -= 8
            decoded.push((buffer >> bits) & 0xff)
        }
    }
    if (bits !== 0 || decoded.length !== 35 || decoded[34] !== 3) return false

    const publicKey = Buffer.from(decoded.slice(0, 32))
    const version = Buffer.from([decoded[34]])
    const checksum = createHash('sha3-256')
        .update('.onion checksum')
        .update(publicKey)
        .update(version)
        .digest()
        .subarray(0, 2)
    return checksum[0] === decoded[32] && checksum[1] === decoded[33]
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
