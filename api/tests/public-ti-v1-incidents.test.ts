import { describe, expect, test } from 'bun:test'
import { testApp, validateResponse } from './helpers/public-ti-v1.ts'

describe('public TI v1', () => {
    test('publishes governed incident attribution and automatic-review lineage without attributing ambiguous decisions', async () => {
        const baseIncident = {
            sourceId: 'internal-source-id-must-not-leak',
            captureId: 'internal-capture-id-must-not-leak',
            title: 'Governed incident',
            summary: 'Safe summary',
            confidence: 0.9,
            assertionKind: 'inferred',
            reviewReasons: ['internal-review-note-must-not-leak'],
            notes: ['internal-incident-note-must-not-leak'],
        }
        const automaticReview = {
            taskId: 'internal-task-must-not-leak',
            requestSha256: 'internal-request-hash-must-not-leak',
            reviewerId: 'internal-automatic-reviewer-must-not-leak',
            modelStrategy: 'internal-model-strategy-must-not-leak',
            reasons: ['internal-automatic-reason-must-not-leak'],
            configuredModelVersion: 'hanasand-v1',
            runtimeIdentity: { status: 'completed', provider: 'hanasand-ai', model: 'hanasand-inspur', client: 'internal-client-must-not-leak', conversationId: 'internal-conversation-must-not-leak' },
            promptVersion: 'prompt.v1',
            responseSchemaVersion: 'response.v1',
            evidenceProjectionSchema: 'evidence.v1',
            selectedEvidenceIds: ['internal-selected-evidence-must-not-leak'],
            linkedEvidenceCount: 1,
            linkedSourceCount: 1,
            linkedIndependentSourceCount: 1,
            reviewedAt: '2026-07-23T10:00:00.000Z',
            action: 'confirm',
            claimValidity: 'supported',
            confidence: 0.92,
        }
        const app = await testApp(async () => Response.json({
            incidents: [
                {
                    ...baseIncident,
                    id: 'incident-confirmed',
                    reviewState: 'confirmed',
                    actorAttribution: {
                        identityId: 'actor-apt29',
                        externalId: 'G0016',
                        catalogId: 'mitre-enterprise',
                        canonicalName: 'APT29',
                        aliases: ['Midnight Blizzard'],
                        supportingEvidenceIds: ['internal-supporting-evidence-must-not-leak'],
                        provenance: {
                            taskId: 'internal-attribution-task-must-not-leak',
                            requestSha256: 'internal-attribution-hash-must-not-leak',
                            reviewerId: 'internal-reviewer-must-not-leak',
                            promptVersion: 'prompt.v1',
                        },
                    },
                    automaticReview,
                },
                {
                    ...baseIncident,
                    id: 'incident-ambiguous',
                    reviewState: 'needs_review',
                    actorAttribution: null,
                    automaticReview: { ...automaticReview, action: 'mark_needs_review', claimValidity: 'uncertain', confidence: 0.4 },
                },
                {
                    ...baseIncident,
                    id: 'incident-negative',
                    reviewState: 'rejected',
                    actorAttribution: {
                        identityId: 'must-not-leak',
                        canonicalName: 'Unconfirmed actor',
                        aliases: [],
                        supportingEvidenceIds: [],
                        provenance: { reviewerId: 'internal-negative-reviewer-must-not-leak' },
                    },
                    automaticReview: { ...automaticReview, action: 'reject', claimValidity: 'invalid', confidence: 0.2 },
                },
            ],
            total: 3,
        }))
        const response = await app.inject({ method: 'GET', url: '/api/v1/incidents', headers: { 'x-api-key': 'valid' } })
        expect(response.statusCode).toBe(200)
        const body = response.json()
        expect(body.data[0]).toMatchObject({
            id: 'incident-confirmed',
            actorAttribution: {
                externalId: 'G0016',
                catalogId: 'mitre-enterprise',
                canonicalName: 'APT29',
                aliases: ['Midnight Blizzard'],
                supportingEvidenceCount: 1,
                provenance: { promptVersion: 'prompt.v1' },
            },
            automaticReview: {
                configuredModelVersion: 'hanasand-v1',
                runtimeIdentity: { status: 'completed', provider: 'hanasand-ai', model: 'hanasand-inspur' },
                linkedEvidenceCount: 1,
                linkedSourceCount: 1,
                linkedIndependentSourceCount: 1,
            },
        })
        expect(body.data[1].actorAttribution).toBeNull()
        expect(body.data[2].actorAttribution).toBeNull()
        const serialized = JSON.stringify(body)
        for (const forbidden of [
            'internal-task-must-not-leak',
            'internal-request-hash-must-not-leak',
            'internal-client-must-not-leak',
            'internal-conversation-must-not-leak',
            'internal-selected-evidence-must-not-leak',
            'internal-supporting-evidence-must-not-leak',
            'internal-attribution-task-must-not-leak',
            'internal-attribution-hash-must-not-leak',
            'internal-reviewer-must-not-leak',
            'internal-negative-reviewer-must-not-leak',
            'internal-review-note-must-not-leak',
            'internal-incident-note-must-not-leak',
            'internal-automatic-reviewer-must-not-leak',
            'internal-model-strategy-must-not-leak',
            'internal-automatic-reason-must-not-leak',
            'internal-source-id-must-not-leak',
            'internal-capture-id-must-not-leak',
        ]) expect(serialized).not.toContain(forbidden)
        expect(validateResponse('/incidents', 'get', 200, body)).toBe(true)
    })
})
