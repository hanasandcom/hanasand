import { actorProfileHref } from '../../../src/utils/ti/actorProfileRoute'
import { assert } from '../assert'
import { profile } from '../runtimeContext'

assert(actorProfileHref('The Gentlemen') === '/ti/thegentlemen', 'Actor profile links should use the real name as a lowercase URL slug.')

assert(profile.actorClass === 'Named threat actor or activity cluster', 'Actor class should stay generic when no sourced class is supplied.')
assert(profile.malwareTools.length === 0, 'Actor tooling must not be inferred from the actor name.')
assert(profile.campaigns.some(item => /Microsoft disclosed/i.test(item)), 'Campaign context should come from captured activity.')
assert(profile.campaignTimeline.some(item => /Microsoft disclosed/i.test(item.title) && item.firstReportedAt === '2024-01-25' && item.sourceIds.includes('microsoft') && item.provenanceRefs.length), 'APT29 should expose source-backed campaign timeline rows.')
assert(profile.campaignTimeline.every(item => item.title && item.firstReportedAt && item.confidence > 0 && item.freshness), 'Campaign timeline rows should carry date, confidence, and freshness state.')
assert(profile.indicators.some(item => /SUNBURST/i.test(item)), 'APT29 should expose indicator context.')
assert(profile.techniqueCoverage.some(item => item.attackId === 'T1078.004' && item.sourceIds.length === 0 && item.missing.includes('sourceId') && item.missing.includes('captureId')), 'Technique coverage should expose missing evidence links instead of borrowing unrelated profile sources.')
assert(profile.techniqueCoverage.every(item => item.name && item.tactic && item.detail && item.freshness === 'review'), 'Unlinked technique coverage should remain review-only.')
assert(profile.targetSectors.some(item => /Government/i.test(item)), 'APT29 should include government targeting context.')
assert(profile.sourceProvenance.length >= 1, 'APT29 should expose source provenance.')
assert(profile.provenanceRows.some(item => item.sourceName === 'Microsoft' && item.reportDate === '2024-01-25' && item.shownBecause), 'APT29 should expose structured source/date/confidence provenance.')
assert(profile.provenanceRows.some(item => item.sourceRequestId === 'src_req_microsoft_2024_01' && item.parserStatus === 'partial' && item.lastCollectedAt === '2024-01-26'), 'Actor provenance should preserve source request and parser metadata from upstream enrichment.')
assert(profile.provenanceRows.every(item => item.sourceName && item.provenance && item.shownBecause), 'Every actor provenance row should explain why it is shown.')
assert(profile.sourceCoverage.totalRows >= profile.provenanceRows.length, 'APT29 source coverage should account for provenance rows.')
assert(profile.sourceCoverage.datedRows >= 1, 'APT29 source coverage should count dated provenance rows.')
assert(profile.sourceCoverage.sourceFamilies.some(item => item.family === 'vendor_disclosure'), 'APT29 source coverage should classify vendor disclosures.')
assert(!profile.sourceCoverage.sourceFamilies.some(item => item.family === 'government_advisory'), 'Actor coverage must not invent a government source that is absent from the response.')
assert(profile.sourceCoverage.stale, 'APT29 source coverage should require review when newest report evidence is stale.')
assert(profile.sourceCoverage.missing.includes('sourceProvenance[].captureId'), 'APT29 source coverage should expose missing capture references.')
assert(profile.freshness.stale, 'APT29 stale public evidence should be explicitly freshness-gated.')
assert(profile.confidenceReasoning.length >= 2, 'APT29 should expose confidence reasoning.')
