// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { sanitizeTiResultForPublicPage } from '../src/app/ti/publicResult'
import type { TiSearchResponse } from '../src/utils/ti/search'

test('public page projection keeps sourced catalog description, references and dates', () => {
    const candidate = { canonicalName: 'APT29', associatedNames: [], description: 'Catalog history.(Citation: Research 2026)', referenceSources: [{ name: 'Research 2026', url: 'https://example.com/report' }], createdAt: '2014-11-17', modifiedAt: '2026-08-05' }
    const result = { recentActivity: [], sources: [], actorIdentity: { candidates: [candidate] } } as unknown as TiSearchResponse
    expect(sanitizeTiResultForPublicPage(result)?.actorIdentity?.candidates[0]).toMatchObject(candidate)
})

test('public page projection preserves public references and drops private URLs', () => {
    const result = {
        recentActivity: [],
        sources: [
            { id: 'public', name: 'Public report', type: 'report', url: 'https://reports.example/public' },
            { id: 'private', name: 'Internal service', type: 'report', url: 'http://127.0.0.1/admin' },
        ],
        actorIdentity: {
            candidates: [{
                canonicalName: 'APT29',
                associatedNames: [],
                referenceSources: [
                    { name: 'Public reference', url: 'https://reports.example/apt29' },
                    { name: 'Internal reference', url: 'http://localhost/private' },
                ],
            }],
        },
    } as unknown as TiSearchResponse

    const projected = sanitizeTiResultForPublicPage(result)
    expect(projected?.sources[0]?.url).toBe('https://reports.example/public')
    expect(projected?.sources[1]?.url).toBeUndefined()
    expect(projected?.actorIdentity?.candidates[0]?.referenceSources).toContainEqual({
        name: 'Public reference',
        url: 'https://reports.example/apt29',
    })
    expect(JSON.stringify(projected)).not.toMatch(/127\.0\.0\.1|localhost/)
    expect(sanitizeTiResultForPublicPage(null)).toBeNull()
})
