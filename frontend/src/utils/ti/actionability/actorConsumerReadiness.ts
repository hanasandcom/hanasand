import type { TiSearchResponse } from '../search'
import type { PublicTiActorEnrichmentCoverageExport, PublicTiActorEnrichmentConsumerReadinessReceipt, PublicTiActorEnrichmentConsumerReadinessRow, PublicTiActorEnrichmentCoverageBlocker, PublicTiActorEnrichmentConsumerReadinessBlocker } from './types/actorReadiness'
import { uniqueStrings, newestTimestamp } from './geography'
import type { PublicTiOrgSourceFamily } from './types/organizationRelevance'
import { actorIdForQuery } from './actionPayloads'

export function buildPublicTiActorEnrichmentConsumerReadiness(input: {
    result: TiSearchResponse
    actorEnrichmentCoverage: PublicTiActorEnrichmentCoverageExport
}): PublicTiActorEnrichmentConsumerReadinessReceipt {
    const rows = input.actorEnrichmentCoverage.consumers.map((consumer): PublicTiActorEnrichmentConsumerReadinessRow => {
        const relevantRows = input.actorEnrichmentCoverage.coverageRows.filter(row => {
            if (consumer.consumer === 'publicTI') return true
            if (consumer.consumer === 'alertGeneration') return row.alertableCandidates > 0 || row.coverageState !== 'covered'
            return row.coverageState !== 'covered'
        })
        const blockerCodes = uniqueStrings(relevantRows.flatMap(row => row.blockerCodes)) as PublicTiActorEnrichmentCoverageBlocker['code'][]
        const retryRows = relevantRows.filter(row => row.coverageState === 'retry')
        const sourceFamilies = uniqueStrings(relevantRows.map(row => row.sourceFamily)) as PublicTiOrgSourceFamily[]
        const parserStatuses = uniqueStrings(relevantRows.map(row => row.parserStatus))
        const state: PublicTiActorEnrichmentConsumerReadinessRow['state'] = consumer.ready && !blockerCodes.length
            ? 'ready'
            : consumer.consumer === 'sourceOps' && blockerCodes.length
                ? 'action_required'
                : 'blocked'

        return {
            consumer: consumer.consumer,
            ready: consumer.ready && !blockerCodes.length,
            state,
            route: consumer.route.path,
            sourceFamilies,
            parserStatuses,
            coverageCounts: {
                covered: relevantRows.filter(row => row.coverageState === 'covered').length,
                pending: relevantRows.filter(row => row.coverageState === 'pending').length,
                retryable: retryRows.length,
                blocked: relevantRows.filter(row => row.coverageState === 'blocked').length,
                alertable: relevantRows.filter(row => row.alertableCandidates > 0).length,
            },
            retry: {
                retryable: retryRows.length > 0,
                nextRetryAt: newestTimestamp(retryRows.map(row => row.nextRetryAt)),
                retryFields: uniqueStrings(retryRows.map(row => row.field)),
            },
            blockerCodes,
            provenanceIds: {
                actorEnrichmentCoverageSchemaVersion: input.actorEnrichmentCoverage.schemaVersion,
                coverageRowIds: relevantRows.map(row => row.rowId),
                sourceHealthProofIds: uniqueStrings(relevantRows.flatMap(row => row.provenance.sourceHealthProofIds)),
                sourceEnrichmentIntakeItemIds: uniqueStrings(relevantRows.flatMap(row => row.provenance.sourceEnrichmentIntakeItemIds)),
            },
        }
    })
    const blockerSummary = rows.flatMap(row =>
        input.actorEnrichmentCoverage.blockers
            .filter(blocker => row.blockerCodes.includes(blocker.code))
            .map((blocker): PublicTiActorEnrichmentConsumerReadinessBlocker => ({
                code: blocker.code,
                consumer: row.consumer,
                field: blocker.field,
                ownerLane: blocker.ownerLane,
                action: blocker.nextAction,
                nextRetryAt: blocker.nextRetryAt,
                provenanceRef: blocker.provenanceRef,
            })),
    )

    return {
        schemaVersion: 'ti.public_actor.actor_enrichment_consumer_readiness_receipt.v1',
        sourceContractSchemaVersion: 'ti.source_provenance_actor_enrichment_consumer_readiness_receipt.v1',
        query: input.result.query,
        actorId: actorIdForQuery(input.result.query),
        generatedAt: input.result.generatedAt,
        publicTiRoute: `/ti/${encodeURIComponent(input.result.query)}`,
        actorEnrichmentCoverageSchemaVersion: input.actorEnrichmentCoverage.schemaVersion,
        rows,
        blockerSummary,
        sourceHealth: {
            sourceFamilies: input.actorEnrichmentCoverage.summary.sourceFamilies,
            parserStatuses: uniqueStrings(input.actorEnrichmentCoverage.coverageRows.map(row => row.parserStatus)),
            coveredFieldCount: input.actorEnrichmentCoverage.summary.coveredFieldCount,
            pendingFieldCount: input.actorEnrichmentCoverage.coverageRows.filter(row => row.coverageState === 'pending').length,
            retryableFieldCount: input.actorEnrichmentCoverage.summary.retryableFieldCount,
            blockedFieldCount: input.actorEnrichmentCoverage.summary.blockedFieldCount,
            alertableFieldCount: input.actorEnrichmentCoverage.summary.alertableFamilyCount,
            nextRetryAt: input.actorEnrichmentCoverage.summary.nextRetryAt,
        },
        payloadShape: [
            'rows[].coverageCounts',
            'rows[].retry',
            'rows[].provenanceIds',
            'blockerSummary',
            'sourceHealth',
        ],
        safeOutput: {
            rawTargetsExposed: false,
            restrictedMetadataLeaked: false,
            privateTelegramContentExposed: false,
            liveNetworkScrapeStarted: false,
            crossOrgDataIncluded: false,
        },
    }
}
