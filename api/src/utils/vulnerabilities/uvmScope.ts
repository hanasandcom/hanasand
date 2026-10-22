import { resolve4 } from 'node:dns/promises'
import { isIPv4 } from 'node:net'
import ipaddr from 'ipaddr.js'

const maxAddresses = 5

export function normalizeUvmHostname(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a domain name.')
    const input = value.trim().replace(/\.$/, '').toLowerCase()
    if (input.includes('://') || input.includes('/') || input.includes('@') || input.includes(':') || input.includes('?') || input.includes('#') || input.length > 253 || !input.includes('.')) throw new Error('Enter a domain name without a URL, path, or port.')
    const labels = input.split('.')
    if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error('Enter a valid public domain name.')
    if (isIPv4(input) || input === 'localhost' || input.endsWith('.localhost') || input.endsWith('.local')) throw new Error('Enter a public domain name, not an IP address or local hostname.')
    return input
}

export async function resolvePublicUvmAddresses(hostname: string) {
    const addresses = [...new Set(await resolve4(hostname))].sort()
    if (!addresses.length || addresses.length > maxAddresses) throw new Error(`The domain must resolve to between 1 and ${maxAddresses} IPv4 addresses for this scan profile.`)
    const unsafe = addresses.find(address => {
        try { return ipaddr.parse(address).range() !== 'unicast' } catch { return true }
    })
    if (unsafe) throw new Error('The domain resolves to an address that this scanner will not scan.')
    return addresses
}

export function parseAuthorizedAddresses(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).sort()
    if (typeof value === 'string') {
        try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String).sort() : [] } catch { return [] }
    }
    return []
}

export function sameAuthorizedAddressSet(left: string[], right: string[]) {
    const a = [...left].sort()
    const b = [...right].sort()
    return a.length > 0 && a.length === b.length && a.every((address, index) => address === b[index])
}
