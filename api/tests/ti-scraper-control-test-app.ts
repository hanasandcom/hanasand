import { afterEach } from 'bun:test'
import Fastify from 'fastify'
import { HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'
import { getTiScraperControl, postTiScraperControl } from '../src/handlers/ti/scraperControl.ts'

const originalBase = process.env.TI_SCRAPER_API_BASE
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalBase
})

export function controlApp(role?: string, withApiKey = false) {
    const app = Fastify()
    if (role || withApiKey) {
        app.addHook('onRequest', (request, _reply, done) => {
            request.headers.id = 'ti-operator'
            Object.assign(request, {
                ...(withApiKey ? { apiKeyAuth: { ownerId: 'ti-operator' } } : {}),
                ...(role ? { rateLimitSession: {
                    user: { id: 'ti-operator' },
                    organizationMembership: {
                        organizationId: HANASAND_ORGANIZATION_ID,
                        organizationStatus: 'active',
                        membershipStatus: 'active',
                        role,
                    },
                    session: { token: 'session-token' },
                    refreshed: { token: 'session-token', expires_at: '2030-01-01T00:00:00.000Z' },
                } } : {}),
            })
            done()
        })
    }
    app.get('/api/ti/scraper/control', getTiScraperControl)
    app.post('/api/ti/scraper/control', postTiScraperControl)
    return app
}

export async function postControl(payload: unknown) {
    const requests: Array<{ pathname: string, method: string | undefined, body: unknown, authorization: string | null }> = []
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input))
        requests.push({
            pathname: url.pathname,
            method: init?.method,
            body: JSON.parse(String(init?.body)),
            authorization: new Headers(init?.headers).get('authorization'),
        })
        return Response.json({ accepted: true })
    }
    const app = controlApp('editor')
    try {
        const response = await app.inject({ method: 'POST', url: '/api/ti/scraper/control', headers: { authorization: 'Bearer session-token' }, payload })
        return { response, requests }
    } finally {
        await app.close()
    }
}
