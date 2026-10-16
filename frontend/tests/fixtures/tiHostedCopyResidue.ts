import { apt29Result } from './tiActionability'
import type { TiSearchResponse } from '../../src/utils/ti/search'

export function apt29WithHostedCopyResidue(): TiSearchResponse {
    const result = apt29Result()
    result.claims = [{
        id: 'claim_apt29_microsoft',
        claimType: 'victim',
        summary: 'Microsoft reported the activity.',
        confidence: 0.84,
        reviewState: 'confirmed',
        corroborationState: 'corroborated',
        sourceCount: 2,
        evidenceCount: 2,
        uncertaintyReasons: [],
    }]
    result.incidents = [{
        id: 'incident_apt29_microsoft',
        title: 'APT29 Microsoft incident candidate',
        summary: 'Parser-generated candidate from the captured report.',
        confidence: 0.8,
        assertionKind: 'inferred',
        reviewState: 'needs_review',
        sourceId: 'src_microsoft_midnight_blizzard',
        captureId: 'capture_microsoft_apt29_2024',
        extractorVersion: 'deterministic-v1',
        reviewReasons: ['Analyst confirmation is pending.'],
    }]
    result.evidenceAssessment = {
        ready: true,
        confidence: 0.84,
        sourceCount: 2,
        captureCount: 2,
        confirmedClaimCount: 1,
        corroboratedClaimCount: 1,
        validationCount: 1,
        contradictedClaimCount: 0,
        metadataOnly: false,
        reasons: ['Two independent sources are represented.'],
        missingFields: [],
    }
    result.actorIdentity = {
        catalogMatched: true,
        ambiguous: false,
        activityEvidenceAvailable: true,
        candidates: [{
            catalogId: 'mitre-attack-enterprise',
            externalId: 'G0016',
            canonicalName: 'APT29',
            description: 'A public catalog description used in the profile.',
            associatedNames: ['Midnight Blizzard'],
            matchKinds: ['canonical'],
            status: 'current',
            aptNumberDesignationPresent: true,
            sourceUrl: 'https://attack.mitre.org/groups/G0016/',
            createdAt: '2008-01-01T00:00:00.000Z',
            modifiedAt: '2026-04-28T00:00:00.000Z',
            catalogVersion: '18.0',
            catalogModifiedAt: '2026-04-28T00:00:00.000Z',
            captureId: 'capture_mitre_catalog_18',
            privateOperationalNotes: 'Must not cross the public allow list.',
        } as NonNullable<TiSearchResponse['actorIdentity']>['candidates'][number]],
    }
    result.ttps[0]!.detail = 'Tradecraft aligns with returned ATT&CK techniques for credential and cloud activity.'
    result.actionability!.watchlistCandidates![0]!.reason = 'Public reporting and returned actor profile include Microsoft email intrusion context.'
    result.actionability!.handoffs!.watchlist!.payloads[0]!.notes = 'apt29: Actor target sector from returned profile: Technology and cloud services.'
    result.actionability!.enrichmentGaps = [{
        id: 'gap_returned_observations',
        title: 'Returned as evidence',
        severity: 'medium',
        detail: 'What returned: returned observations from stale actor-profile copy.',
        dependency: 'returned profile',
    }]
    return result
}
