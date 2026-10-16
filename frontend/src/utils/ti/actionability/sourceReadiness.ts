import type { TiSearchResponse } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { PublicTiOrgRelevanceProof } from './types/organizationRelevance'
import type { EnrichmentGapQueueItem, PublicTiSourceHealthQueue, PublicTiSourceHealthRow, PublicTiSourceEnrichmentIntake, PublicTiSourceEnrichmentIntakeItem } from './types/sourceEnrichment'
import type { TiActionabilityModel, PublicTiReadinessContract, PublicTiReadinessBlocker } from './types/actionability'
import { uniqueStrings, uniqueBy } from './geography'
import { sourceHealthFamilyForGap } from './caseReadiness'

export function buildPublicTiSourceHealthQueue(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    orgRelevance: PublicTiOrgRelevanceProof
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    exportPayloads: TiActionabilityModel['exportPayloads']
}): PublicTiSourceHealthQueue {
    const coverageRows = input.orgRelevance.sourceCoverage.map((source): PublicTiSourceHealthRow => {
        const matchingProvenance = input.actor.provenanceRows.find(row =>
            row.sourceId === source.sourceId
            || row.sourceName === source.sourceName
            || row.provenance === source.provenance
        )
        const matchingGaps = input.orgRelevance.enrichmentGaps.filter(gap =>
            gap.sourceFamily === source.sourceFamily
            || /source|capture|provenance/i.test(gap.field)
            || (source.status === 'missing_capture' && /capture/i.test(gap.field))
        )
        const requestedFields = uniqueStrings([
            ...matchingGaps.map(gap => gap.field),
            ...(!source.captureId ? ['sourceProvenance[].captureId'] : []),
            ...(!source.sourceRequestId && !source.captureId ? ['sourceProvenance[].sourceRequestId'] : []),
            ...(!matchingProvenance?.reportDate && !source.lastCollectedAt ? ['actorIntelligence.structuredProvenance[].reportDate'] : []),
        ])
        const timestamp = source.lastCollectedAt || matchingProvenance?.reportDate || input.actor.sourceCoverage.latestReportDate || input.result.lastSeen || ''
        const stale = input.actor.freshness.stale || input.actor.sourceCoverage.stale
        const parserStatus = source.parserStatus || (source.status === 'capture_ready'
            ? stale ? 'capture linked; freshness review' : 'capture linked'
            : source.status === 'missing_capture'
                ? source.sourceRequestId ? 'source request queued' : 'capture needed'
                : stale ? 'public reference; freshness review' : 'public reference')
        const state: PublicTiSourceHealthRow['state'] = source.status === 'capture_ready'
            ? stale ? 'review' : 'ready'
            : source.status === 'missing_capture'
                ? source.sourceRequestId ? 'review' : 'blocked'
                : stale || requestedFields.length ? 'review' : 'ready'

        return {
            id: `source-health:${source.sourceId ?? source.sourceName}:${source.provenance}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: source.sourceName,
            sourceFamily: source.sourceFamily,
            provenance: source.provenance,
            timestamp,
            parserStatus,
            state,
            confidence: source.confidence,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceId: source.sourceId,
            route: matchingGaps[0]?.route || input.exportPayloads.enrichment.backedRoute || '/ti/profiles',
            requestedFields,
            ownerLane: source.status === 'missing_capture' ? 'source' : stale ? 'public-ti' : 'source',
            nextAction: source.status === 'capture_ready'
                ? stale ? 'Refresh this source before using it as customer-facing evidence.' : 'Inspect this capture and attach it to the selected case draft when relevant.'
                : source.status === 'missing_capture'
                    ? source.sourceRequestId ? 'Track the source request and attach the resulting capture ID when collection completes.' : 'Attach a capture ID or source request ID in source enrichment.'
                    : 'Verify report date and source capture before routing to alert or case work.',
        }
    })

    const coverageKeys = new Set(coverageRows.map(row => `${row.sourceFamily}:${row.sourceName}`.toLowerCase()))
    const gapRows = input.enrichmentGapQueue
        .filter(gap => !coverageKeys.has(`${gap.sourceFamily}:${gap.title}`.toLowerCase()))
        .map((gap): PublicTiSourceHealthRow => ({
            id: `source-health-gap:${gap.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: gap.title,
            sourceFamily: sourceHealthFamilyForGap(gap.sourceFamily),
            provenance: gap.dependency,
            timestamp: input.actor.sourceCoverage.latestReportDate || input.result.lastSeen || '',
            parserStatus: 'enrichment queued',
            state: gap.severity === 'high' ? 'blocked' : 'review',
            route: gap.route,
            requestedFields: gap.requestedFields,
            ownerLane: gap.sourceFamily === 'alert' ? 'alert' : gap.sourceFamily === 'case' ? 'case' : gap.sourceFamily === 'watchlist' ? 'org' : 'source',
            nextAction: gap.detail,
        }))

    const rows = uniqueBy([...coverageRows, ...gapRows], row => row.id).sort((a, b) => {
        const stateRank = { blocked: 0, review: 1, ready: 2 }
        return stateRank[a.state] - stateRank[b.state] || a.sourceName.localeCompare(b.sourceName)
    }).slice(0, 10)

    return {
        schemaVersion: 'ti.public_actor.source_health_queue.v1',
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        rows,
        summary: {
            total: rows.length,
            ready: rows.filter(row => row.state === 'ready').length,
            review: rows.filter(row => row.state === 'review').length,
            blocked: rows.filter(row => row.state === 'blocked').length,
        },
    }
}

export function buildPublicTiSourceEnrichmentIntake(input: {
    result: TiSearchResponse
    sourceHealthQueue: PublicTiSourceHealthQueue
    readiness: PublicTiReadinessContract
}): PublicTiSourceEnrichmentIntake {
    const items = input.sourceHealthQueue.rows.map((row): PublicTiSourceEnrichmentIntakeItem => {
        const blockedBy = sourceIntakeBlockers(row, input.readiness)
        return {
            schemaVersion: 'ti.public_actor.source_enrichment_intake_item.v1',
            id: `source-intake:${row.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceHealthRowId: row.id,
            sourceName: row.sourceName,
            sourceFamily: row.sourceFamily,
            state: blockedBy.length && row.state === 'ready' ? 'review' : row.state,
            route: row.route,
            ownerLane: row.ownerLane,
            sourceId: row.sourceId,
            sourceRequestId: row.sourceRequestId,
            captureId: row.captureId,
            requestedFields: row.requestedFields,
            evidence: {
                provenance: row.provenance,
                timestamp: row.timestamp,
                confidence: row.confidence,
                parserStatus: row.parserStatus,
            },
            blockedBy,
            recommendedAction: sourceIntakeAction(row, blockedBy),
            nextAction: row.nextAction,
        }
    })

    return {
        schemaVersion: 'ti.public_actor.source_enrichment_intake.v1',
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        route: '/ti/profiles',
        items,
        summary: {
            total: items.length,
            ready: items.filter(item => item.state === 'ready').length,
            review: items.filter(item => item.state === 'review').length,
            blocked: items.filter(item => item.state === 'blocked').length,
            sourceRequests: items.filter(item => Boolean(item.sourceRequestId)).length,
            captures: items.filter(item => Boolean(item.captureId)).length,
        },
    }
}

export function sourceIntakeBlockers(row: PublicTiSourceHealthRow, readiness: PublicTiReadinessContract): PublicTiReadinessBlocker[] {
    const fields = row.requestedFields.join(' ')
    const rowNeedsCapture = !row.captureId || /capture/i.test(fields)
    const rowNeedsSource = !row.sourceId || !row.provenance || /source|provenance/i.test(fields)
    return readiness.blockers.filter(blocker => {
        if (blocker.ownerLane !== 'source' && blocker.ownerLane !== 'public-ti') return false
        if (blocker.code === 'missing_capture') return rowNeedsCapture
        if (blocker.code === 'missing_source_provenance') return rowNeedsSource
        if (blocker.code === 'stale_provenance') return row.state !== 'ready' || /fresh|reportDate|lastSeen/i.test(fields)
        return row.ownerLane === blocker.ownerLane
    })
}

export function sourceIntakeAction(row: PublicTiSourceHealthRow, blockers: PublicTiReadinessBlocker[]): PublicTiSourceEnrichmentIntakeItem['recommendedAction'] {
    if (row.captureId && !blockers.some(blocker => blocker.code === 'stale_provenance')) return 'inspect_capture'
    if (row.sourceRequestId && !row.captureId) return 'track_source_request'
    if (blockers.some(blocker => blocker.code === 'stale_provenance')) return 'refresh_source'
    if (!row.captureId) return 'attach_capture'
    return 'queue_enrichment'
}
