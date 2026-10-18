import { assert } from '../assert'
import {
    pageClientSource,
} from '../sourceText'

assert(pageClientSource.includes('watchlistBasis,'), 'Selected case create request should export watchlist basis in the request body.')
assert(pageClientSource.includes('actionReplay,'), 'Selected case create request should export case action replay linkage in the request body.')
assert(pageClientSource.includes('selectedCaseActorContextFor'), 'Selected case create request should include actor intelligence context.')
assert(pageClientSource.includes('actorContext,'), 'Selected case create request should export actor context in the request body.')
assert(pageClientSource.includes('actor.techniqueCoverage.slice'), 'Selected case actor context should preserve technique coverage rows.')
assert(pageClientSource.includes('actor.campaignTimeline.slice'), 'Selected case actor context should preserve campaign timeline rows.')
assert(pageClientSource.includes('actionability.enrichmentGapQueue.slice'), 'Selected case actor context should preserve enrichment gaps.')
assert(pageClientSource.includes('data-ti-source-coverage'), 'Public TI dossier should expose source coverage for render checks.')
assert(pageClientSource.includes('Source coverage'), 'Public TI dossier should summarize source coverage.')
assert(pageClientSource.includes('source question'), 'Public TI enrichment statuses should use source-question language instead of implementation labels.')
assert(pageClientSource.includes('data-ti-org-actor-identity'), 'Public TI org relevance should render actor identity fields.')
assert(pageClientSource.includes('ti.public_actor.watchlist_intersection_request.v1'), 'Watchlist intersections should export versioned request payloads.')
assert(pageClientSource.includes('data-ti-watchlist-term-requests'), 'Watchlist relevance should render row-level watchlist term requests.')
assert(pageClientSource.includes('ti.public_actor.watchlist_term_request.v1'), 'Watchlist terms should export versioned add/monitor requests.')
assert(pageClientSource.includes('ti.public_actor.watchlist_source_intake.v1'), 'Watchlist term exports should include a typed source-lane intake bundle.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Watchlist term request\''), 'Watchlist terms should expose copyable add/monitor request payloads.')
assert(pageClientSource.includes('watchlistTermRequestPayloadFor(term, watchlist, actionability, query)'), 'Watchlist term exports should preserve query, route, blockers, provenance, and related refs.')
assert(pageClientSource.includes('sourceHealthRows'), 'Watchlist term exports should include matching source-health rows for enrichment handoff.')
assert(pageClientSource.includes('sourceEnrichmentIntake.items.filter'), 'Watchlist term exports should include source enrichment intake items.')
assert(pageClientSource.includes('requestedFields: unique(sourceIntakeItems.flatMap'), 'Watchlist term exports should expose requested enrichment fields.')
assert(pageClientSource.includes('Actor identity'), 'Public TI org relevance should label actor identity without implementation wording.')
for (const section of ['Overview', 'Activity', 'Targeting', 'Infrastructure', 'Sources', 'Evidence', 'Watchlist Relevance', 'Related alerts/cases', 'Actions']) {
    assert(pageClientSource.toLowerCase().includes(section.toLowerCase()), `Public TI page should expose analyst-native section: ${section}.`)
}
for (const oldLabel of ['Priority Queue', 'Actor Profile', 'Reported Victims and Targets', 'Observed Tradecraft', 'Alert Packet', 'Workflow', 'Company Exposure', 'Monitoring Coverage', 'Monitoring Mix', 'Sources Used', 'Enrichment Queue']) {
    assert(!pageClientSource.includes(`title='${oldLabel}'`) && !pageClientSource.includes(`title="${oldLabel}"`) && !pageClientSource.includes(`>${oldLabel}<`), `Public TI page should not use legacy/demo-like section label: ${oldLabel}.`)
}
assert(pageClientSource.includes('Review sources'), 'Public TI decision flow should start with source review.')
assert(pageClientSource.includes('Open case'), 'Public TI decision flow should include case routing.')
assert(!pageClientSource.includes('Ready for ${'), 'Public TI visible copy should not expose endpoint-shaped ready labels.')
assert(!pageClientSource.includes('API result data is live'), 'Public TI queue should not expose implementation-literal API copy.')
assert(!pageClientSource.includes('Open DWM workbench'), 'Public TI action labels should not expose internal product-lane naming.')
assert(!pageClientSource.includes('Case payload'), 'Public TI page should not expose raw payload labels as analyst-facing copy.')
assert(!pageClientSource.includes('API work'), 'Public TI enrichment labels should not expose implementation-literal API work copy.')
assert(pageClientSource.includes('whitespace-nowrap'), 'Public TI action buttons should prevent stacked action text.')
assert(!pageClientSource.includes('`source ${sourceId}`'), 'Public TI source/provenance rows should not render raw source IDs.')
assert(!pageClientSource.includes('`capture ${row.captureId}`'), 'Public TI source/provenance rows should not render raw capture IDs.')
assert(pageClientSource.includes('<span className=\'h-2.5 w-2.5 rounded-full bg-ui-primary\' />Origin'), 'Public TI map legend should use customer-facing origin language.')
assert(pageClientSource.includes('<span className=\'h-2.5 w-2.5 rounded-full bg-ui-danger\' />Target'), 'Public TI map legend should use customer-facing target language.')
assert(!pageClientSource.includes('Source review task'), 'Public TI map should not expose internal source-review tasks.')
assert(pageClientSource.includes('compact ? \'h-60\' : \'h-80\''), 'Public TI compact map should stay subordinate to selected evidence in the first viewport.')
assert(!pageClientSource.includes('Country-Level Actor Map'), 'Public TI map title should avoid dashboard/report language.')
assert(pageClientSource.includes('ti.public_actor.selected_artifact.v1'), 'Selected artifact export should carry a versioned payload schema.')
