import type { TiSearchResponse } from '../search'
import type { PublicTiSourceHealthQueue, PublicTiSourceEnrichmentIntake, PublicTiSourceHealthRow } from './types/sourceEnrichment'
import type { PublicTiActorEnrichmentCoverageExport, PublicTiActorEnrichmentCoverageRow, PublicTiActorEnrichmentCoverageBlocker } from './types/actorReadiness'
import { uniqueStrings } from './geography'
import type { PublicTiOrgSourceFamily } from './types/organizationRelevance'

export function buildPublicTiActorEnrichmentCoverage(input: {
    result: TiSearchResponse
    sourceHealthQueue: PublicTiSourceHealthQueue
    sourceEnrichmentIntake: PublicTiSourceEnrichmentIntake
}): PublicTiActorEnrichmentCoverageExport {
    const rows = input.sourceHealthQueue.rows.map((row): PublicTiActorEnrichmentCoverageRow => {
        const matchingItems = input.sourceEnrichmentIntake.items.filter(item =>
            item.sourceHealthRowId === row.id
            || item.sourceId === row.sourceId
            || item.sourceRequestId === row.sourceRequestId
            || item.captureId === row.captureId
        )
        const coverageState = actorCoverageState(row)
        const blockerCodes = actorCoverageBlockerCodes(row, coverageState)
        return {
            rowId: `actor-coverage:${row.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            field: actorCoverageField(row),
            sourceFamily: row.sourceFamily,
            coverageState,
            parserStatus: row.parserStatus,
            lastSuccessAt: row.captureId ? row.timestamp : undefined,
            nextRetryAt: /retry/i.test(row.parserStatus) ? row.timestamp : undefined,
            alertableCandidates: row.captureId || row.sourceRequestId ? 1 : 0,
            blockerCodes,
            provenance: {
                sourceHealthRowId: row.id,
                sourceEnrichmentIntakeItemIds: matchingItems.map(item => item.id),
                sourceHealthProofIds: uniqueStrings([row.sourceId, row.sourceRequestId, row.captureId]),
                sourceId: row.sourceId,
                sourceRequestId: row.sourceRequestId,
                captureId: row.captureId,
            },
        }
    })
    const blockers = rows.flatMap(row => row.blockerCodes.map((code): PublicTiActorEnrichmentCoverageBlocker => ({
        code,
        ownerLane: actorCoverageOwner(code),
        field: row.field,
        sourceFamily: row.sourceFamily,
        nextAction: actorCoverageNextAction(code),
        nextRetryAt: row.nextRetryAt,
        provenanceRef: row.provenance.sourceHealthRowId,
    })))
    const hasCovered = rows.some(row => row.coverageState === 'covered')
    const hasRetryOrPolicy = blockers.some(blocker => blocker.code === 'parser_retry' || blocker.code === 'policy_blocked')
    const actorId = `actor:${input.result.query.trim().toLowerCase() || 'unknown'}`

    return {
        schemaVersion: 'ti.public_actor.actor_enrichment_coverage_export.v1',
        sourceContractSchemaVersion: 'ti.source_provenance_actor_enrichment_coverage_export.v1',
        query: input.result.query,
        actorId,
        generatedAt: input.result.generatedAt,
        publicTiRoute: `/ti/${encodeURIComponent(input.result.query)}`,
        receiptState: 'derived_from_public_ti',
        coverageRows: rows,
        blockers,
        summary: {
            fieldCount: rows.length,
            coveredFieldCount: rows.filter(row => row.coverageState === 'covered').length,
            blockedFieldCount: rows.filter(row => row.coverageState === 'blocked').length,
            retryableFieldCount: rows.filter(row => row.coverageState === 'retry').length,
            alertableFamilyCount: rows.filter(row => row.alertableCandidates > 0).length,
            sourceFamilies: uniqueStrings(rows.map(row => row.sourceFamily)) as PublicTiOrgSourceFamily[],
            nextRetryAt: rows.find(row => row.nextRetryAt)?.nextRetryAt,
        },
        consumers: [{
            consumer: 'publicTI',
            ready: rows.length > 0,
            requiredFields: ['coverageRows[].field', 'coverageRows[].coverageState', 'coverageRows[].provenance', 'blockers[].code'],
            route: {
                method: 'GET',
                path: `/ti/${encodeURIComponent(input.result.query)}`,
                dryRunSupported: true,
                liveNetworkFetch: false,
            },
        }, {
            consumer: 'alertGeneration',
            ready: hasCovered && !hasRetryOrPolicy,
            requiredFields: ['coverageRows[].alertableCandidates', 'coverageRows[].provenance.sourceHealthProofIds', 'summary.nextRetryAt'],
            route: {
                method: 'POST',
                path: '/v1/dwm/alerts/rebuild',
                body: {
                    actor: input.result.query,
                    publicTiCoverageExportId: actorId,
                    dryRun: true,
                },
                dryRunSupported: true,
                liveNetworkFetch: false,
            },
        }, {
            consumer: 'sourceOps',
            ready: blockers.length > 0,
            requiredFields: ['blockers[].nextAction', 'coverageRows[].sourceFamily', 'coverageRows[].parserStatus', 'coverageRows[].provenance.sourceHealthProofIds'],
            route: {
                method: 'POST',
                path: input.sourceEnrichmentIntake.route,
                body: {
                    actor: input.result.query,
                    coverageExport: true,
                    dryRun: true,
                },
                dryRunSupported: true,
                liveNetworkFetch: false,
            },
        }],
        safeOutput: {
            rawTargetsExposed: false,
            restrictedMetadataLeaked: false,
            privateTelegramContentExposed: false,
            liveNetworkScrapeStarted: false,
        },
    }
}

export function actorCoverageState(row: PublicTiSourceHealthRow): PublicTiActorEnrichmentCoverageRow['coverageState'] {
    if (/retry|failed/i.test(row.parserStatus)) return 'retry'
    if (row.state === 'ready') return 'covered'
    if (row.state === 'blocked') return 'blocked'
    return 'pending'
}

export function actorCoverageBlockerCodes(row: PublicTiSourceHealthRow, state: PublicTiActorEnrichmentCoverageRow['coverageState']): PublicTiActorEnrichmentCoverageBlocker['code'][] {
    if (state === 'covered') return []
    if (/retry|failed/i.test(row.parserStatus)) return ['parser_retry']
    if (row.ownerLane === 'entitlement') return ['policy_blocked']
    if (!row.sourceRequestId && !row.captureId) return ['missing_candidate']
    return ['coverage_pending']
}

export function actorCoverageOwner(code: PublicTiActorEnrichmentCoverageBlocker['code']): PublicTiActorEnrichmentCoverageBlocker['ownerLane'] {
    if (code === 'parser_retry') return 'parser'
    if (code === 'policy_blocked') return 'policy'
    if (code === 'missing_candidate') return 'source'
    return 'publicTI'
}

export function actorCoverageNextAction(code: PublicTiActorEnrichmentCoverageBlocker['code']): PublicTiActorEnrichmentCoverageBlocker['nextAction'] {
    if (code === 'parser_retry') return 'retry_parser'
    if (code === 'policy_blocked') return 'request_policy_approval'
    if (code === 'missing_candidate') return 'request_candidate'
    return 'inspect_source_health'
}

export function actorCoverageField(row: PublicTiSourceHealthRow): string {
    const fields = row.requestedFields.join(' ')
    if (/campaign/i.test(fields)) return 'campaigns'
    if (/infrastructure|capture|sourceProvenance/i.test(fields)) return 'sourceProvenance'
    if (/sector/i.test(fields)) return 'sectors'
    if (/region|geo|country/i.test(fields)) return 'regions'
    if (/malware|tool/i.test(fields)) return 'malwareTools'
    if (/technique|ttp/i.test(fields)) return 'techniques'
    return row.sourceFamily
}
