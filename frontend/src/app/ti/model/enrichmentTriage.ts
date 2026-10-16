import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SelectedEnrichmentTriage, type SelectedSourceDrilldown } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique } from './evidenceValues'
import { createTiSafeOutputMetadata } from './safeOutput'

export function selectedEnrichmentTriageFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    drilldown: SelectedSourceDrilldown | null
): SelectedEnrichmentTriage {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const drilldownSourceIds = drilldown?.rows.map(row => row.sourceId).filter((value): value is string => Boolean(value)) ?? []
    const sourceIds = unique([...selectedSourceIds, ...drilldownSourceIds])
    const rows = actionability.sourceHealthQueue.rows.filter(row =>
        (row.sourceId ? sourceIds.includes(row.sourceId) : false)
        || (row.captureId ? selected.evidence.some(line => line.includes(row.captureId ?? '')) : false)
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const selectedRows = rows.length ? rows : actionability.sourceHealthQueue.rows.slice(0, 3)
    const selectedRowIds = new Set(selectedRows.map(row => row.id))
    const selectedRequestIds = new Set(selectedRows.map(row => row.sourceRequestId).filter(Boolean))
    const selectedCaptureIds = new Set(selectedRows.map(row => row.captureId).filter(Boolean))
    const selectedIntakeItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        selectedRowIds.has(item.sourceHealthRowId)
        || (item.sourceRequestId ? selectedRequestIds.has(item.sourceRequestId) : false)
        || (item.captureId ? selectedCaptureIds.has(item.captureId) : false)
        || (item.sourceId ? sourceIds.includes(item.sourceId) : false)
    )
    const triageRows = selectedRows.map(row => {
        const matchingIntakeItems = selectedIntakeItems.filter(item =>
            item.sourceHealthRowId === row.id
            || item.sourceRequestId === row.sourceRequestId
            || item.sourceId === row.sourceId
            || item.captureId === row.captureId
        )
        const consumerReadiness = actionability.actorEnrichmentConsumerReadiness.rows.filter(consumer =>
            consumer.sourceFamilies.includes(row.sourceFamily)
            || consumer.parserStatuses.includes(row.parserStatus)
            || consumer.provenanceIds.sourceHealthProofIds.includes(row.id)
            || matchingIntakeItems.some(item => consumer.provenanceIds.sourceEnrichmentIntakeItemIds.includes(item.id))
        )
        const primaryIntakeItem = matchingIntakeItems[0]
        return {
            id: row.id,
            sourceName: row.sourceName,
            sourceFamily: row.sourceFamily,
            state: row.state,
            route: row.route,
            ownerLane: primaryIntakeItem?.ownerLane ?? row.ownerLane,
            remediationPath: primaryIntakeItem?.route ?? row.route,
            lastChecked: primaryIntakeItem?.evidence.timestamp ?? row.timestamp,
            recommendedAction: primaryIntakeItem?.nextAction ?? row.nextAction,
            sourceId: row.sourceId,
            sourceRequestId: row.sourceRequestId,
            captureId: row.captureId,
            requestedFields: row.requestedFields,
            nextAction: row.nextAction,
            matchingIntakeItemIds: matchingIntakeItems.map(item => item.id),
            blockers: matchingIntakeItems.flatMap(item => item.blockedBy.map(blocker => blocker.detail)),
            evidence: {
                provenance: row.provenance,
                timestamp: row.timestamp,
                confidence: row.confidence,
                parserStatus: row.parserStatus,
            },
            consumerReadiness: consumerReadiness.map(consumer => ({
                consumer: consumer.consumer,
                state: consumer.state,
                ready: consumer.ready,
                route: consumer.route,
                blockerCodes: consumer.blockerCodes,
                retryable: consumer.retry.retryable,
                nextRetryAt: consumer.retry.nextRetryAt,
            })),
        }
    })
    const blockers = triageRows.reduce((count, row) => count + row.requestedFields.length + row.blockers.length, 0)
    const state: SelectedEnrichmentTriage['state'] = triageRows.some(row => row.state === 'blocked') || blockers ? 'blocked' : triageRows.some(row => row.state === 'review') ? 'review' : 'ready'
    return {
        schemaVersion: 'ti.public_actor.selected_enrichment_triage.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: actionability.sourceEnrichmentIntake.generatedAt,
        selectedItemId: selected.id,
        title: selected.title,
        route: actionability.sourceEnrichmentIntake.route,
        state,
        summary: {
            sourceRows: triageRows.length,
            intakeItems: selectedIntakeItems.length,
            blockers,
            sourceRequests: selectedIntakeItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: selectedIntakeItems.filter(item => Boolean(item.captureId)).length,
        },
        rows: triageRows,
        safeOutput: createTiSafeOutputMetadata(),
    }
}
