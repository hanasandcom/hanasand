import { describe, expect, test } from 'bun:test'
import { publicTiOpenApi } from '../src/contracts/publicTiOpenApi.ts'
import { resolveRef, testApp, validateResponse } from './helpers/public-ti-v1.ts'

describe('public TI v1', () => {
    test('publishes the implemented versioned contract without fake mutation resources', async () => {
        const app = await testApp()
        const response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' })
        expect(response.statusCode).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store, max-age=0')
        const spec = response.json()
        expect(spec.openapi).toBe('3.1.0')
        expect(Object.keys(spec.paths)).toEqual(['/ti/search', '/ti/search/batch', '/actors', '/aliases', '/incidents', '/findings', '/evidence', '/sources', '/validations', '/alerts', '/evaluation', '/timeliness'])
        expect(spec.paths['/ti/search'].post.security).toEqual([])
        expect(spec.paths['/actors'].get.security).toEqual([{ ApiKey: [] }, { SessionBearer: [], SessionId: [] }])
        expect(spec.paths['/alerts'].get.security).toEqual([{ ApiKey: [] }])
        expect(spec.components.schemas.SearchResult.required).not.toContain('lastSeen')
        for (const name of ['ActorAttributionProvenance', 'IncidentActorAttribution', 'ModelRuntimeIdentity', 'IncidentAutomaticReview', 'Incident', 'Validation']) {
            const fields = Object.keys(spec.components.schemas[name].properties)
            for (const forbidden of ['taskId', 'requestSha256', 'reviewerId', 'identityId', 'client', 'conversationId', 'supportingEvidenceIds', 'selectedEvidenceIds', 'reviewReasons']) {
                expect(fields).not.toContain(forbidden)
            }
        }
        const incidentFields = Object.keys(spec.components.schemas.Incident.properties)
        expect(incidentFields).not.toContain('sourceId')
        expect(incidentFields).not.toContain('captureId')
        expect(JSON.stringify(spec)).not.toContain('additionalProperties":true')
    })

    test('publishes reusable pagination parameters and correct operation names', () => {
        const spec = publicTiOpenApi
        expect(Object.keys(spec.info)).toEqual(['title', 'version'])
        expect((spec.paths['/aliases'] as any).get.operationId).toBe('listActorAliases')
        expect((spec.paths['/timeliness'] as any).get.operationId).toBe('listTimeliness')
        const ids = Object.values(spec.paths).flatMap((path: any) => Object.values(path).map((op: any) => op.operationId))
        expect(new Set(ids).size).toBe(ids.length)
        for (const path of Object.values(spec.paths) as any[]) {
            if (!path.get) continue
            for (const parameter of path.get.parameters) expect(resolveRef(parameter.$ref)).toHaveProperty('schema')
        }
        expect(spec.components.parameters.Page.schema).toMatchObject({ type: 'integer', minimum: 1, default: 1 })
        expect(spec.components.parameters.Cursor.deprecated).toBe(true)
        const cursor = spec.components.parameters.Cursor
        expect(new RegExp(String(cursor.schema.pattern)).test('50')).toBe(true)
        expect(new RegExp(String(cursor.schema.pattern)).test('invalid')).toBe(false)
    })

    test('serves paginated findings while preserving the old route and its access checks', async () => {
        const requested: URL[] = []
        const app = await testApp(async input => {
            const url = new URL(String(input))
            requested.push(url)
            const offset = url.searchParams.get('cursor') || String((Number(url.searchParams.get('page') || 1) - 1) * Number(url.searchParams.get('limit') || 50))
            return Response.json({ claims: [{ id: `finding-${offset}`, claimType: 'victim_report', subjectType: 'company', subjectId: 'company-1', value: { company: 'Example' }, summary: 'A source reports an incident.', confidence: 0.5, reviewState: 'needs_review', sourceIds: ['source-1'], captureIds: ['capture-1'] }], total: 2, nextCursor: offset === '0' ? '1' : null })
        })
        for (const route of ['/findings', '/claims']) {
            expect((await app.inject({ method: 'GET', url: `/api/v1${route}` })).statusCode).toBe(401)
            const first = await app.inject({ method: 'GET', url: `/api/v1${route}?limit=1`, headers: { 'x-api-key': 'valid' } })
            expect(first.statusCode).toBe(200)
            expect(validateResponse('/findings', 'get', 200, first.json())).toBe(true)
            const second = await app.inject({ method: 'GET', url: `/api/v1${route}?limit=1&page=${first.json().pagination.nextPage}`, headers: { 'x-api-key': 'valid' } })
            expect(second.json().data[0].id).toBe('finding-1')
            expect(second.json().pagination).toMatchObject({ page: 2, totalPages: 2, nextPage: null })
        }
        expect(requested.every(url => url.pathname === '/v1/intel/claims')).toBe(true)
    })

    test('supports direct pages, empty results, legacy offsets, and rejects invalid collection queries', async () => {
        const offsets: string[] = []
        const app = await testApp(async input => {
            const url = new URL(String(input))
            const offset = url.searchParams.has('cursor') ? Number(url.searchParams.get('cursor')) : (Number(url.searchParams.get('page') || 1) - 1) * Number(url.searchParams.get('limit') || 50)
            offsets.push(String(offset))
            const total = url.searchParams.get('q') === 'empty' ? 0 : 5
            return Response.json({ actorProfiles: offset < total ? [{ id: `actor-${offset}`, canonicalName: 'Example', aliases: [], confidence: 0.8, sourceIds: [], captureIds: [] }] : [], total, nextCursor: offset + 2 < total ? String(offset + 2) : null })
        })
        const get = (query: string) => app.inject({ method: 'GET', url: `/api/v1/actors?limit=2&${query}`, headers: { 'x-api-key': 'valid' } })
        expect((await get('page=2')).json().pagination).toMatchObject({ page: 2, total: 5, totalPages: 3, nextPage: 3 })
        const last = (await get('page=3')).json()
        expect(last.pagination).toMatchObject({ page: 3, totalPages: 3, nextPage: null })
        expect(last.data[0].id).toBe('actor-4')
        expect((await get('page=4')).json()).toMatchObject({ data: [], pagination: { page: 4, nextPage: null } })
        expect((await get('q=empty')).json()).toMatchObject({ data: [], pagination: { page: 1, totalPages: 0, nextPage: null } })
        expect((await get('cursor=2')).json().pagination.nextCursor).toBe('4')
        expect(offsets).toEqual(['2', '4', '6', '0', '2'])
        for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=', 'page=1&page=2', 'page=9007199254740991', 'cursor=', 'cursor=1e1', 'cursor=0x10', 'page=1&cursor=0', `q=${'x'.repeat(201)}`]) {
            const response = await get(query)
            expect(response.statusCode).toBe(400)
            expect(response.json().error.code).toBe('invalid_pagination')
        }
        expect(offsets).toHaveLength(5)
    })
})
