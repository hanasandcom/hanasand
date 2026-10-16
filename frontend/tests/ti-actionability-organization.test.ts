import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { victimObservationsFor } from '../src/utils/ti/actorProfile'
import { buildTiActionability } from '../src/utils/ti/actionability'
import { apt29Result, assert, readArray, readObject } from './fixtures/tiActionability'
// @ts-expect-error Bun provides this module when running tests.
import { test } from 'bun:test'

test('actor and organization relevance carry backed handoff context', () => {

    const result = apt29Result()
    const victims = victimObservationsFor(result)
    const actor = buildActorIntelligence(result, victims)
    const apt29 = buildTiActionability(result, actor, victims)

    assert(apt29.orgRelevance.actorIdentity.canonicalName === 'APT29', 'Org relevance should carry the canonical actor name.')
    assert(apt29.orgRelevance.actorIdentity.aliases.includes('Midnight Blizzard'), 'Org relevance should carry actor aliases.')
    assert(apt29.orgRelevance.actorIdentity.aliases.includes('Nobelium'), 'Org relevance should carry alternate names.')
    assert(apt29.orgRelevance.actorIdentity.actorClass === 'State-linked espionage actor', 'Org relevance should carry actor class.')
    assert(apt29.orgRelevance.actorIdentity.sectors.includes('Technology and cloud services'), 'Org relevance should carry backed target sectors.')
    assert(apt29.orgRelevance.actorIdentity.regions.includes('United States'), 'Org relevance should carry backed target regions.')
    assert(apt29.orgRelevance.sourceCoverage.some(source =>
        source.sourceId === 'src_microsoft_midnight_blizzard'
        && source.sourceFamily === 'vendor_disclosure'
        && source.status === 'capture_ready'
        && source.captureId === 'capture_microsoft_apt29_2024'
        && source.supportsTerms.includes('microsoft.com')
    ), 'Org relevance should carry source family, capture, and supported watchlist term.')
    assert(apt29.orgRelevance.enrichmentGaps.length === 0, 'Complete actor, source, and org data should have no enrichment gaps.')
    assert(apt29.orgRelevance.watchlistIntersections.some(item =>
        item.kind === 'domain'
        && item.value === 'microsoft.com'
        && item.state === 'ready'
        && item.organizationId === 'org_acme'
        && item.watchlistId === 'watchlist_acme_vendors'
        && item.watchlistItemId === 'item_microsoft'
        && item.alertIds.includes('alert_apt29_microsoft')
        && item.casePaths.includes('/cases/case_apt29_microsoft')
        && item.captureIds.includes('capture_microsoft_apt29_2024')
        && item.webhookDestinationIds.includes('webhook_security_ops')
        && item.sourceFamilies.includes('vendor_disclosure')
        && item.recommendedAction === 'open_case'
    ), 'Org relevance should link backed org, watchlist, source, alert, and case data.')
    assert(apt29.orgRelevance.affectedEntities.domains.some(entity =>
        entity.value === 'microsoft.com'
    && entity.matched
    && entity.sourceFamily === 'source_capture'
    && entity.watchlistItemIds.includes('item_microsoft')
    && entity.provenanceRefs.includes('capture_microsoft_apt29_2024')
    ), 'An explicit domain watchlist match should produce a source-backed affected domain.')
    assert(apt29.orgRelevance.handoffRows.some(row => row.kind === 'alert_case' && row.alertId === 'alert_apt29_microsoft'), 'Org relevance should expose linked alert/case handoff rows.')

    const bundle = readObject(apt29.actionPayloads.payloads.analystHandoffBundle.body.orgRelevance)
    assert(readObject(bundle).actorIdentity, 'Analyst handoff bundle should include org relevance actor identity.')
    assert(readArray(bundle.sourceCoverage).some(item => readObject(item).status === 'capture_ready'), 'Analyst bundle should include source coverage readiness.')
    assert(readArray(bundle.watchlistIntersections).some(item => readObject(item).recommendedAction === 'open_case'), 'Analyst bundle should include org watchlist intersections.')

    const alertOnlyResult = apt29Result()
    alertOnlyResult.actionability!.relatedCases = []
    const alertOnlyVictims = victimObservationsFor(alertOnlyResult)
    const alertOnlyActor = buildActorIntelligence(alertOnlyResult, alertOnlyVictims)
    const alertOnly = buildTiActionability(alertOnlyResult, alertOnlyActor, alertOnlyVictims)
    assert(alertOnly.relatedCases.some(item =>
        item.id === 'case_apt29_microsoft'
        && item.path === '/cases/case_apt29_microsoft'
    ), 'Actionability should derive related cases from related alert case context.')
    assert(alertOnly.readiness.backedIds.casePaths.includes('/cases/case_apt29_microsoft'), 'Derived related cases should feed readiness case paths.')
})
