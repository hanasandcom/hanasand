import { mock } from 'bun:test'
let jar: Record<string, string> = {}
export const validations: unknown[] = []
export const requests: Array<{ url: string, init?: RequestInit }> = []
const used = new Set<string>()
let state = 'valid'
let status = 201
export const payload = { saved: true, watchlistItem: { id: 'item' }, dwmAlertBridge: { projection: { status: 'pending' } } }
mock.module('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: (name: string) => jar[name] ? { value: jar[name] } : undefined }) }))
mock.module('../../src/utils/proxy/tokenIsValid', () => ({ default: async (token: string, id: string, impersonationToken: string | undefined, options: { deviceProof: { proof: string } }) => {
    validations.push({ token, id, options, ...(impersonationToken ? { impersonationToken } : {}) })
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
export const { proxyOrganizationWatchlistRead } = await import('../../src/app/api/organizations/organizationWatchlistSession')
export function reset() { jar = {}; validations.length = 0; requests.length = 0; used.clear(); state = 'valid'; status = 201; process.env.VM_API_TOKEN = 'synthetic-assertion' }
export function setJar(value: Record<string, string>) { jar = value }
export function setValidationState(value: string) { state = value }
export function setUpstreamStatus(value: number) { status = value }
export function request(path = '/organizations/org/watchlists', method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST', headers: Record<string, string> = {}, body = '{}') {
    return new NextRequest(`https://localhost:3000/api${path}`, { method, headers: { authorization: 'Bearer session', id: 'user', dpop: 'proof', ...headers }, ...(method === 'GET' ? {} : { body }) })
}
export const send = (req = request(), path = '/organizations/org/watchlists', method: 'POST' | 'PUT' | 'DELETE' = 'POST') => proxyOrganizationWatchlistMutation(req, path, { method, organizationId: 'org' })

export const readKinds = ['list', 'item', 'alert-terms'] as const
export function readPath(kind: typeof readKinds[number], id = 'org', itemId = 'item') {
    return `/organizations/${encodeURIComponent(id)}/watchlists${kind === 'list' ? '' : `/${kind === 'item' ? encodeURIComponent(itemId) : kind}`}`
}
export async function readRoute(kind: typeof readKinds[number], req = request(readPath(kind), 'GET'), id = 'org', itemId = 'item') {
    const route = kind === 'list' ? await import('../../src/app/api/organizations/[id]/watchlists/route')
        : kind === 'item' ? await import('../../src/app/api/organizations/[id]/watchlists/[itemId]/route')
            : await import('../../src/app/api/organizations/[id]/watchlists/alert-terms/route')
    return route.GET(req, { params: Promise.resolve({ id, itemId }) })
}
export function rejectedReads() {
    const path = readPath('list')
    return [
        ...['x-tenant-id', 'x-organization-id', 'x-device-proof-method', 'x-device-proof-url', 'x-hanasand-server-session-validated', 'x-hanasand-session-validated'].map(name =>
            [request(path, 'GET', { [name]: name.endsWith('url') ? 'https://foreign.invalid/api'+path : 'other' }), path, 'org'] as const),
        ...['tenantId', 'orgId', 'organizationId'].map(name => [request(`${path}?${name}=org&${name}=other`, 'GET'), path, 'org'] as const),
        [request(path, 'POST'), path, 'org'],
        [request(path+'/other', 'GET'), path, 'org'],
        [request(path, 'GET'), path, 'other'],
        [new NextRequest('https://localhost:3000/api'+path), path, 'org'],
        ...['.', '..', 'bad/item', 'bad\\item', '%2F', '%252F', 'bad\u0000item', 'bad item'].map(id => [request(readPath('list', id), 'GET'), readPath('list', id), id] as const),
        [request('/organizations/org:name/watchlists', 'GET'), '/organizations/org:name/watchlists', 'org:name'],
    ] as const
}
