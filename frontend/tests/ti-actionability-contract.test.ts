import { sanitizeTiResultForPublicPage } from '../src/app/ti/publicResult'
import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { victimObservationsFor } from '../src/utils/ti/actorProfile'
import { buildTiActionability } from '../src/utils/ti/actionability'
import { apt29WithHostedCopyResidue } from './fixtures/tiHostedCopyResidue'
import { assert } from './fixtures/tiActionability'
// @ts-expect-error Bun provides this module when running tests.
import { test } from 'bun:test'

test('public TI result sanitization preserves supported profile and actionability data', () => {

    const sourceResult = apt29WithHostedCopyResidue()
    const sanitized = sanitizeTiResultForPublicPage(sourceResult)
    assert(sanitized, 'Public /ti result sanitizer should return a result.')

    sourceResult.cacheStatus = 'hit'
    assert(sanitizeTiResultForPublicPage(sourceResult)?.cacheStatus === 'hit', 'Public /ti result sanitizer should preserve cache provenance.')
    assert(sanitized.claims?.[0]?.corroborationState === 'corroborated', 'Sanitizer should preserve claim review and corroboration state.')
    assert(sanitized.incidents?.[0]?.assertionKind === 'inferred', 'Sanitizer should preserve inferred incident semantics.')
    assert(sanitized.evidenceAssessment?.sourceCount === 2, 'Sanitizer should preserve independent-source assessment.')
    assert(sanitized.actorIntelligence?.structuredProvenance?.some(row =>
        row.sourceId === 'src_microsoft_midnight_blizzard'
        && row.captureId === 'capture_microsoft_apt29_2024'
        && row.parserStatus === undefined
        && row.provenance === 'https://www.microsoft.com/en-us/security/blog/'
    ), 'Sanitizer should preserve structured provenance for first render.')
    assert(sanitized.actorIntelligence?.businessModel?.publicationStrategies[0]?.value === 'public victim listing', 'Sanitizer should preserve observed business-model mechanisms.')
    assert(sanitized.actorIntelligence?.businessModel?.missingEvidence.includes('payments or conversion'), 'Sanitizer should preserve explicit business-analysis gaps.')

    const candidate = sanitized.actorIdentity?.candidates[0]
    assert(candidate?.externalId === 'G0016', 'Sanitizer should preserve safe actor catalog identity fields.')
    assert(candidate?.description === 'A public catalog description used in the profile.', 'Sanitizer should preserve the catalog description used by the public profile.')
    assert(!('privateOperationalNotes' in (candidate ?? {})), 'Sanitizer must drop fields outside the actor catalog allow list.')
    assert(JSON.stringify(Object.keys(candidate ?? {}).sort()) === JSON.stringify([
        'associatedNames', 'aptNumberDesignationPresent', 'canonicalName', 'captureId', 'catalogId',
        'catalogModifiedAt', 'catalogVersion', 'createdAt', 'description', 'externalId', 'matchKinds',
        'modifiedAt', 'referenceSources', 'sourceUrl', 'status',
    ].sort()), 'Sanitizer should expose only the documented actor catalog fields.')

    assert(sanitized.actionability?.sourceProvenance?.some(row =>
        row.sourceId === 'src_microsoft_midnight_blizzard'
        && row.captureId === 'capture_microsoft_apt29_2024'
    ), 'Sanitizer should preserve source provenance rows.')
    assert(sanitized.actionability?.watchlistMatches?.some(match =>
        match.organizationId === 'org_acme'
        && match.watchlistItemId === 'item_microsoft'
        && match.casePath === '/cases/case_apt29_microsoft'
    ), 'Sanitizer should preserve backed watchlist and case routing.')
    assert(sanitized.actionability?.handoffs?.alertRebuild?.endpoint === '/v1/dwm/alerts/rebuild', 'Sanitizer should preserve the alert rebuild handoff route.')

    const victims = victimObservationsFor(sanitized)
    const actor = buildActorIntelligence(sanitized, victims)
    const actionability = buildTiActionability(sanitized, actor, victims)
    const publicText = JSON.stringify({ result: sanitized, actor, actionability })
    assert(!/\breturned\b|What returned|returned actor profile|returned profile|returned observations|Returned as evidence|returned ATT&CK/i.test(publicText), 'Public APT29 serialization should avoid backend-shaped returned/profile wording.')
    assert(sanitized.actionability?.handoffs?.watchlist?.payloads[0]?.notes.includes('actor profile'), 'Sanitized handoff notes should remain meaningful after copy cleanup.')
    assert(actor.sourceCoverage.captureRows > 0, 'Sanitized /ti result should produce capture-backed source coverage.')
    assert(actor.malwareTools.length === 0, 'Sanitized /ti result must not add actor tools absent from the response.')
    assert(actionability.orgRelevance.watchlistIntersections.some(item =>
        item.state === 'ready'
        && item.recommendedAction === 'open_case'
        && item.sourceFamilies.includes('vendor_disclosure')
    ), 'Sanitized /ti result should still produce alert- and case-ready watchlist relevance.')
    assert(actionability.createAlertHandoff.ready, 'Sanitized /ti result should keep alert handoff ready.')
    assert(actionability.caseHandoff.ready, 'Sanitized /ti result should keep case handoff ready.')
})
