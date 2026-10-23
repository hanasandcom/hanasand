import { mock } from 'bun:test'
let jar: Record<string, string> = {}
export const validations: unknown[] = []
export const requests: Array<{ url: string, init?: RequestInit }> = []
const used = new Set<string>()
let state = 'valid'
let status = 201
export const payload = { saved: true, watchlistItem: { id: 'item' }, dwmAlertBridge: { projection: { status: 'pending' } } }
mock.module('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: (name: string) => jar[name] ? { value: jar[name] } : undefined }) }))
mock.module('../../src/utils/proxy/tokenIsValid', () => ({ default: async (token: string, id: string, _unused: unknown, options: { deviceProof: { proof: string } }) => {
    validations.push({ token, id, options })
    if (used.has(options.deviceProof.proof)) return { valid: false, state: 'invalid' }
    used.add(options.deviceProof.proof)
    return { valid: state === 'valid', state }
} }))
process.env.FRONTEND_AUTH_API = 'https://core.invalid/api'
process.env.SOCIAL_AUTH_ORIGIN = 'https://hanasand.com'
globalThis.fetch = (async (target, init) => { requests.push({ url: String(target), init }); return Response.json(status === 409 ? { error: 'quota_exhausted' } : payload, { status }) }) as typeof fetch
export const { NextRequest } = await import('next/server')
export const { proxyOrganizationWatchlistMutation } = await import('../../src/app/api/organizations/organizationWatchlistMutation')
export const { proxyOrganizationApiRequest } = await import('../../src/app/api/organizations/_organizationApiProxy')
export function reset() { jar = {}; validations.length = 0; requests.length = 0; used.clear(); state = 'valid'; status = 201; process.env.VM_API_TOKEN = 'synthetic-assertion' }
export function setJar(value: Record<string, string>) { jar = value }
export function setValidationState(value: string) { state = value }
export function setUpstreamStatus(value: number) { status = value }
export function request(path = '/organizations/org/watchlists', method: 'POST' | 'PUT' | 'DELETE' = 'POST', headers: Record<string, string> = {}, body = '{}') {
    return new NextRequest(`https://localhost:3000/api${path}`, { method, headers: { authorization: 'Bearer session', id: 'user', dpop: 'proof', ...headers }, body })
}
export const send = (req = request(), path = '/organizations/org/watchlists', method: 'POST' | 'PUT' | 'DELETE' = 'POST') => proxyOrganizationWatchlistMutation(req, path, { method, organizationId: 'org' })
