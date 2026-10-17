import { afterEach } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import Ajv2020 from 'ajv/dist/2020.js'
import publicTiApi from '../../src/handlers/ti/publicApi.ts'
import { publicTiOpenApi } from '../../src/contracts/publicTiOpenApi.ts'

const apps: FastifyInstance[] = []
const originalScraperApiBase = process.env.TI_SCRAPER_API_BASE

export const searchResult = {
    query: 'APT29', generatedAt: '2026-07-22T10:00:00.000Z', mode: 'scraper' as const, status: 'ready' as const, summary: 'Current public evidence for APT29.', confidence: 0.9, lastSeen: '2026-07-22T09:00:00.000Z', aliases: ['Cozy Bear'],
    recentActivity: [{ date: '2026-07-22T09:00:00.000Z', title: 'Source mention', detail: 'Observed source text.', confidence: 0.4, sourceIds: ['src-1'], assertionKind: 'source_claim', reviewState: 'needs_review', corroborationState: 'single_source', observationSummary: 'A captured source record matched the query.' }], targets: [], ttps: [{ name: 'Spearphishing Attachment', tactic: 'Initial Access', detail: 'Source-specific extraction.', confidence: 0.9, extractionMethod: 'source_specific', extractorVersion: 'vendor-parser-v1' }], datasets: [], sources: [{ id: 'src-1', name: 'Public report', type: 'rss', provenance: 'publisher', url: 'https://example.test/report' }], notes: [],
    actorIntelligence: { infrastructure: ['https://news.google.com/rss/articles/opaque-aggregator-id?oc=5', '203.0.113.10', 'https://infra.example.test/path'] },
}

export const cleanupTestApps = async () => {
    await Promise.all(apps.splice(0).map(app => app.close()))
    if (originalScraperApiBase === undefined) delete process.env.TI_SCRAPER_API_BASE
    else process.env.TI_SCRAPER_API_BASE = originalScraperApiBase
}
afterEach(cleanupTestApps)

export async function testApp(fetchImpl: typeof fetch = async () => Response.json({}), searchImpl: any = async () => searchResult) {
    process.env.TI_SCRAPER_API_BASE = 'https://scraper.example.test'
    const app = Fastify({ genReqId: () => crypto.randomUUID() })
    app.addHook('preHandler', async request => {
        if (request.headers['x-api-key'] === 'valid') (request as any).apiKeyAuth = { organizationId: 'org-customer', apiKey: { organizationId: 'org-customer' } }
        if (request.headers['x-api-key'] === 'global') (request as any).apiKeyAuth = { organizationId: null, apiKey: { organizationId: null } }
    })
    await app.register(publicTiApi, { prefix: '/api/v1', fetchImpl, searchImpl })
    apps.push(app)
    return app
}

export function injectedFetch(app: FastifyInstance): typeof fetch {
    return async input => {
        const request = input instanceof Request ? input : new Request(input)
        const response = await app.inject({ method: request.method as any, url: request.url, headers: Object.fromEntries(request.headers), payload: request.body ? await request.text() : undefined })
        return new Response(response.body, { status: response.statusCode, headers: response.headers as HeadersInit })
    }
}

export function validateResponse(path: string, method: string, status: number, body: unknown) {
    const operation = (publicTiOpenApi.paths as Record<string, any>)[path][method]
    const rawResponse = operation.responses[String(status)]
    const response = rawResponse.$ref ? resolveRef(rawResponse.$ref) : rawResponse
    const schema = response.content['application/json'].schema
    const ajv = new Ajv2020({ strict: false, formats: { 'date-time': true, uri: true } })
    ajv.addSchema(publicTiOpenApi, 'contract')
    const validate = ajv.compile(schema.$ref ? { $ref: `contract${schema.$ref}` } : schema)
    if (!validate(body)) throw new Error(ajv.errorsText(validate.errors))
    return true
}

export function resolveRef(pointer: string) {
    return pointer.replace(/^#\//, '').split('/').reduce<any>((value, part) => value[part], publicTiOpenApi)
}
