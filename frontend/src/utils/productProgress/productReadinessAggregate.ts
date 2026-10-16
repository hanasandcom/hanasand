import { readFile } from 'node:fs/promises'
import { firstValue, staleAfterSecondsFromEnv, ageSecondsSince } from './productReadinessAggregateEnv'
import { parseProductReadinessAggregate, isProductReadinessAggregateSourceRow, isAggregateState, isRecord } from './productReadinessAggregateParsing'

import { PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION, INLINE_LEDGER_KEYS, FILE_LEDGER_KEYS, DEFAULT_AGGREGATE_STALE_AFTER_SECONDS, type ProductReadinessAggregate, type ProductReadinessAggregateSource } from './productReadinessAggregateTypes'
export * from './productReadinessAggregateTypes'
export { parseProductReadinessAggregate } from './productReadinessAggregateParsing'

export async function loadProductReadinessAggregate(env: Record<string, string | undefined> = process.env): Promise<ProductReadinessAggregateSource> {
    const inlineLedger = firstValue(INLINE_LEDGER_KEYS, env)
    const parsedInline = parseJsonAggregate(inlineLedger)
    if (parsedInline) return toProductReadinessAggregateSource(parsedInline, 'env:PRODUCT_READINESS_AGGREGATE_JSON', env)

    const filePath = firstValue(FILE_LEDGER_KEYS, env)
    if (!filePath) return missingProductReadinessAggregateSource('product_readiness_aggregate_not_configured')

    try {
        const parsedFile = parseJsonAggregate(await readFile(filePath, 'utf8'))
        return parsedFile
            ? toProductReadinessAggregateSource(parsedFile, filePath, env)
            : missingProductReadinessAggregateSource('product_readiness_aggregate_schema_invalid', filePath)
    } catch {
        return missingProductReadinessAggregateSource('product_readiness_aggregate_file_unavailable', filePath)
    }
}

export function isProductReadinessAggregateSource(input: unknown): input is ProductReadinessAggregateSource {
    if (!isRecord(input)) return false
    return input.schemaVersion === PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION
        && isAggregateState(input.state)
        && typeof input.source === 'string'
        && typeof input.checkedAt === 'string'
        && typeof input.ok === 'boolean'
        && typeof input.rowCount === 'number'
        && typeof input.customerVisibleBlockedCount === 'number'
        && typeof input.deployRisk === 'string'
        && typeof input.staleAfterSeconds === 'number'
        && typeof input.ageSeconds === 'number'
        && typeof input.stale === 'boolean'
        && (typeof input.unavailableReason === 'string' || input.unavailableReason === undefined)
        && Array.isArray(input.blockingRows)
        && input.blockingRows.every(isProductReadinessAggregateSourceRow)
        && (input.state === 'ready' || Boolean(input.unavailableReason) || input.blockingRows.length > 0)
}

export function missingProductReadinessAggregateSource(reason: string, source = 'not configured'): ProductReadinessAggregateSource {
    return {
        schemaVersion: PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION,
        state: 'unavailable',
        source,
        checkedAt: '',
        ok: false,
        rowCount: 0,
        customerVisibleBlockedCount: 0,
        deployRisk: 'unknown',
        staleAfterSeconds: DEFAULT_AGGREGATE_STALE_AFTER_SECONDS,
        ageSeconds: 0,
        stale: false,
        unavailableReason: reason,
        blockingRows: [],
    }
}

function toProductReadinessAggregateSource(
    aggregate: ProductReadinessAggregate,
    source: string,
    env: Record<string, string | undefined>,
): ProductReadinessAggregateSource {
    const staleAfterSeconds = staleAfterSecondsFromEnv(env)
    const blockingRows = aggregate.rows
        .filter(row => row.customerVisible && row.customerVisibleState !== 'ready')
        .map(row => {
            const lastCheckedAgeSeconds = ageSecondsSince(row.lastCheckedAt)
            return {
                id: row.id,
                label: row.capabilityLabel,
                ownerLane: row.ownerLane,
                state: row.customerVisibleState,
                lastCheckedAt: row.lastCheckedAt,
                lastCheckedAgeSeconds,
                lastCheckedStale: lastCheckedAgeSeconds > staleAfterSeconds,
                blockers: row.blockers,
                proofArtifactSchemaVersion: row.proofArtifact.schemaVersion,
                proofArtifactId: row.proofArtifact.artifactId,
                route: row.proofArtifact.route || row.workflowContract?.route || '',
                probeId: row.proofArtifact.probeId || row.workflowContract?.proofRowId || '',
                requiredNextAction: row.requiredNextAction,
                deployRisk: row.deployRisk,
                uiQualityProofExists: row.uiQualityProofExists,
                workflowRoute: row.workflowContract?.route || '',
                workflowProofRowId: row.workflowContract?.proofRowId || '',
                workflowTestName: row.workflowContract?.testName || '',
                workflowExpectedAdapter: row.workflowContract?.expectedAdapter || '',
                workflowProofCommand: row.workflowContract?.proofCommand || '',
            }
        })
    const ageSeconds = ageSecondsSince(aggregate.checkedAt)
    const stale = ageSeconds > staleAfterSeconds
    const state = aggregate.ok && blockingRows.length === 0 && !stale
        ? 'ready'
        : aggregate.deployRisk === 'high' || blockingRows.some(row => row.state === 'blocked')
            ? 'blocked'
            : 'needs_action'
    return {
        schemaVersion: PRODUCT_READINESS_AGGREGATE_SOURCE_SCHEMA_VERSION,
        state,
        source,
        checkedAt: aggregate.checkedAt,
        ok: aggregate.ok,
        rowCount: aggregate.rowCount,
        customerVisibleBlockedCount: aggregate.customerVisibleBlockedCount,
        deployRisk: aggregate.deployRisk,
        staleAfterSeconds,
        ageSeconds,
        stale,
        unavailableReason: state === 'ready' ? undefined : stale ? 'product_readiness_aggregate_stale' : 'product_readiness_aggregate_blocked',
        blockingRows,
    }
}

function parseJsonAggregate(input: string | undefined) {
    if (!input?.trim()) return undefined
    try {
        return parseProductReadinessAggregate(JSON.parse(input))
    } catch {
        return undefined
    }
}
