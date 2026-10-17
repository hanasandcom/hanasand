import { describe, expect, test } from 'bun:test'
import { testApp, validateResponse } from './helpers/public-ti-v1.ts'

describe('public TI v1', () => {
    test('structurally bounds public incident strings, arrays, enums, counts, and finite values', async () => {
        const oversized = 'x'.repeat(5_000)
        const app = await testApp(async () => Response.json({
            incidents: [{
                id: oversized,
                title: oversized,
                summary: oversized,
                firstSeenAt: 'not-a-date',
                confidence: Number.POSITIVE_INFINITY,
                reviewState: 'confirmed',
                actorAttribution: {
                    identityId: 'actor-1',
                    canonicalName: oversized,
                    aliases: Array.from({ length: 101 }, () => oversized),
                    supportingEvidenceCount: 101,
                    supportingEvidenceIds: Array.from({ length: 101 }, (_, index) => `internal-${index}`),
                    provenance: { promptVersion: oversized },
                },
                automaticReview: {
                    configuredModelVersion: oversized,
                    runtimeIdentity: { status: 'internal_pending', provider: oversized, model: oversized },
                    linkedEvidenceCount: 100_001,
                    linkedSourceCount: Number.NaN,
                    linkedIndependentSourceCount: -1,
                    action: 'internal_action',
                    claimValidity: 'internal_validity',
                    confidence: Number.NEGATIVE_INFINITY,
                    notes: [oversized],
                    modelStrategy: oversized,
                },
                extractorVersion: oversized,
            }],
            total: 1,
        }))

        const response = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        const body = response.json()
        const incident = body.data[0]
        expect(incident.id).toHaveLength(200)
        expect(incident.title).toHaveLength(500)
        expect(incident.summary).toHaveLength(4000)
        expect(incident.reviewState).toBe('confirmed')
        expect(incident.extractorVersion).toHaveLength(200)
        expect(incident.actorAttribution.canonicalName).toHaveLength(200)
        expect(incident.actorAttribution.aliases).toHaveLength(100)
        expect(incident.actorAttribution.aliases.every((alias: string) => alias.length === 200)).toBe(true)
        expect(incident.actorAttribution.supportingEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.configuredModelVersion).toHaveLength(200)
        expect(incident.automaticReview.runtimeIdentity).toBeUndefined()
        expect(incident.automaticReview.linkedEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.linkedSourceCount).toBeUndefined()
        expect(incident.automaticReview.linkedIndependentSourceCount).toBeUndefined()
        expect(incident.automaticReview.action).toBeUndefined()
        expect(incident.automaticReview.claimValidity).toBeUndefined()
        expect(incident.automaticReview.confidence).toBeUndefined()
        expect(incident.firstSeenAt).toBeUndefined()
        expect(incident.confidence).toBeUndefined()
        expect(JSON.stringify(incident)).not.toContain('modelStrategy')
        expect(JSON.stringify(incident)).not.toContain('notes')
        expect(validateResponse('/incidents', 'get', 200, body)).toBe(true)
    })

    test('omits missing incident metrics and accepts only explicit finite numeric values', async () => {
        const app = await testApp(async input => {
            const path = new URL(String(input)).pathname
            if (path.endsWith('/incidents')) return Response.json({
                incidents: [{
                    id: 'incident-missing-metrics',
                    sourceId: 'source-1',
                    captureId: 'capture-1',
                    title: 'Incident without fabricated metrics',
                    summary: 'Missing numbers stay missing.',
                    confidence: null,
                    assertionKind: 'inferred',
                    reviewState: 'confirmed',
                    reviewReasons: [],
                    actorAttribution: {
                        identityId: 'actor-1',
                        canonicalName: 'APT29',
                        aliases: [],
                        supportingEvidenceCount: '',
                        provenance: { promptVersion: 'prompt.v1' },
                    },
                    automaticReview: {
                        configuredModelVersion: 'hanasand-v1',
                        linkedEvidenceCount: '',
                        linkedSourceCount: null,
                        linkedIndependentSourceCount: 'not-a-number',
                        confidence: '',
                    },
                }],
                total: 1,
            })
            return Response.json({
                timeliness: [{
                    id: 'timeliness-missing-metrics',
                    sourceId: 'source-1',
                    captureId: 'capture-1',
                    incidentId: 'incident-missing-metrics',
                    latencies: {
                        publicationToCollectionSeconds: null,
                        collectionToProcessingSeconds: '',
                        processingToVisibilitySeconds: '12.5',
                        reportToVisibilitySeconds: Number.POSITIVE_INFINITY,
                    },
                    timestampAnomalies: [],
                }],
                total: 1,
            })
        })

        const incidentResponse = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        const incidentBody = incidentResponse.json()
        const incident = incidentBody.data[0]
        expect(incident.confidence).toBeUndefined()
        expect(incident.actorAttribution.supportingEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.linkedEvidenceCount).toBeUndefined()
        expect(incident.automaticReview.linkedSourceCount).toBeUndefined()
        expect(incident.automaticReview.linkedIndependentSourceCount).toBeUndefined()
        expect(incident.automaticReview.confidence).toBeUndefined()
        expect(validateResponse('/incidents', 'get', 200, incidentBody)).toBe(true)

        const timelinessResponse = await app.inject({ method: 'GET', url: '/api/v1/timeliness', headers: { 'x-api-key': 'valid' } })
        const timeliness = timelinessResponse.json().data[0]
        expect(timeliness.latencies).toEqual({ processingToVisibilitySeconds: 12.5 })
        expect(validateResponse('/timeliness', 'get', 200, timelinessResponse.json())).toBe(true)
    })
})
