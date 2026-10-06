import { isPublicMonitoringAddress } from '../publicMonitoringRequest.ts'
import ipaddr from 'ipaddr.js'

type Network = {
    provider: string | null
    country: string | null
    country_code: string | null
    region: string | null
    city: string | null
}
const geoipUrl = (process.env.HANASAND_GEOIP_URL || 'http://geoip:18300').trim().replace(/\/$/, '')
const serviceToken = process.env.HANASAND_GEOIP_SERVICE_TOKEN || ''
const pendingLookups = new Map<string, Promise<Network | null>>()
let nextWarningAt = 0

async function lookupNetwork(ip: string): Promise<Network | null> {
    if (!geoipUrl || !serviceToken) return null
    const existing = pendingLookups.get(ip)
    if (existing) return existing

    const lookup = (async () => {
        const url = new URL(`${geoipUrl}/v1/lookup`)
        url.searchParams.set('ip', ip)
        const response = await fetch(url, {
            headers: { 'x-hanasand-service-token': serviceToken },
            signal: AbortSignal.timeout(3_000),
        })
        if (!response.ok) throw new Error(`GeoIP service returned HTTP ${response.status}`)
        const body = await response.json() as { network?: unknown }
        if (body.network === null) return null
        if (!body.network || typeof body.network !== 'object') throw new Error('GeoIP service returned an invalid response')
        const network = body.network as Partial<Network>
        return {
            provider: typeof network.provider === 'string' ? network.provider : null,
            country: typeof network.country === 'string' ? network.country : null,
            country_code: typeof network.country_code === 'string' ? network.country_code : null,
            region: typeof network.region === 'string' ? network.region : null,
            city: typeof network.city === 'string' ? network.city : null,
        }
    })()
    pendingLookups.set(ip, lookup)
    try {
        return await lookup
    } finally {
        pendingLookups.delete(ip)
    }
}

export async function sessionNetwork(value: string) {
    let ip = ''
    try { ip = ipaddr.process(value).toString() } catch { /* Legacy records may not contain an IP. */ }
    if (!isPublicMonitoringAddress(ip)) {
        // VPNs and local networks can reach the service without a public address.
        // Preserve that distinction without pretending a private IP is geolocatable.
        const range = ip ? ipaddr.parse(ip).range() : ''
        if (['private', 'uniqueLocal', 'carrierGradeNat'].includes(range)) {
            return { ip: null, network: null, private_ip: ip }
        }
        return { ip: null, network: null }
    }
    try {
        return { ip, network: await lookupNetwork(ip) }
    } catch (error) {
        if (Date.now() >= nextWarningAt) {
            nextWarningAt = Date.now() + 60_000
            console.warn('Session location service unavailable:', error instanceof Error ? error.message : error)
        }
        return { ip, network: null }
    }
}
