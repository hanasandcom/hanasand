import type { WorkbenchAction, WorkbenchCase, WorkbenchCaseMutationAction, CaseMutationInput, WorkbenchOrgContext } from '../types'
import { readJson, deliveryEvidenceFromPayload } from './payloadParsing'

export function stringValue(value: unknown) {
    const normalized = typeof value === 'string' ? value.trim() : ''
    return normalized || undefined
}

export function objectValue(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function arrayValue(value: unknown) {
    return Array.isArray(value) ? value : []
}

export function stringArrayValue(value: unknown) {
    return arrayValue(value).map(item => stringValue(item)).filter((item): item is string => Boolean(item))
}

export function numberValue(value: unknown) {
    const normalized = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(normalized) ? normalized : undefined
}

export function actionResultMessage(action: WorkbenchAction, payload: Awaited<ReturnType<typeof readJson>>) {
    if (payload.case?.id) return `Case ${payload.case.id} is ${payload.case.status || 'open'}.`
    if (typeof payload.savedAlertCount === 'number') return `Rebuilt ${payload.savedAlertCount} alert${payload.savedAlertCount === 1 ? '' : 's'}.`
    if (typeof payload.attemptedCount === 'number') return webhookDeliveryResultMessage(payload)
    if (action.id === 'request_source_coverage') {
        const sourcePayload = payload as Record<string, unknown>
        const sourceStatusMessage = sourceOperationsActionMessage(sourcePayload)
        if (sourceStatusMessage) return sourceStatusMessage
        const summary = objectValue(sourcePayload.summary) || {}
        const createdCount = numberValue(summary.telegramPublicCreated ?? summary.darkwebMetadataCreated ?? summary.createdCount) ?? 0
        const duplicateCount = numberValue(summary.duplicateCount) ?? 0
        if (Number.isFinite(createdCount) && Number.isFinite(duplicateCount) && (createdCount || duplicateCount)) return `Source request applied: ${createdCount} created, ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}.`
        const source = objectValue(sourcePayload.source)
        const candidate = objectValue(sourcePayload.candidate)
        const sourceId = stringValue(source?.id)
        const candidateId = stringValue(candidate?.id)
        if (sourceId) return `Source ${sourceId} is scheduled for coverage.`
        if (candidateId) return `Source candidate ${candidateId} is scheduled for review.`
        return 'Source coverage request accepted.'
    }
    if (action.id === 'run_canary_collection') {
        const canaryPayload = payload as Record<string, unknown>
        const canaryRun = canaryPayload.canaryRun && typeof canaryPayload.canaryRun === 'object' ? canaryPayload.canaryRun as Record<string, unknown> : {}
        const inserted = Number(canaryRun.insertedCaptureCount ?? canaryPayload.insertedCaptureCount ?? 0)
        const failed = Number(canaryRun.failedTaskCount ?? canaryPayload.failedTaskCount ?? 0)
        if (Number.isFinite(inserted) || Number.isFinite(failed)) return `Canary run finished with ${Number.isFinite(inserted) ? inserted : 0} capture${inserted === 1 ? '' : 's'} and ${Number.isFinite(failed) ? failed : 0} failure${failed === 1 ? '' : 's'}.`
        return 'Canary collection run accepted.'
    }
    const webhookDeliveries = deliveryEvidenceFromPayload(payload, 'webhook_action')
    if (webhookDeliveries[0]) return `Webhook test ${webhookDeliveries[0].status || 'recorded'} as ${webhookDeliveries[0].id}.`
    if (payload.testedAt) return `Webhook test recorded at ${payload.testedAt}.`
    return `${action.label} completed.`
}

export function webhookDeliveryResultMessage(payload: Awaited<ReturnType<typeof readJson>>) {
    const deliveries = deliveryEvidenceFromPayload(payload, 'delivery_result')
    if (deliveries.length) {
        const summary = deliveries
            .slice(0, 3)
            .map(delivery => `${delivery.id}:${delivery.status}`)
            .join(', ')
        const suffix = deliveries.length > 3 ? `, +${deliveries.length - 3} more` : ''
        return `Webhook delivery result: ${summary}${suffix}.`
    }
    return 'No durable delivery result was returned.'
}

export function alertReplayResultMessage(payload: Awaited<ReturnType<typeof readJson>>, item: WorkbenchCase) {
    const blockerCodes = [...(payload.workflowExecutionReadiness?.blockerCodes || []), ...(payload.downstreamHandoff?.blockerCodes || [])]
        .filter((code, index, source) => Boolean(code) && source.indexOf(code) === index)
    if (payload.workflowExecutionReadiness?.ready === false || blockerCodes.length) return `Replay is waiting on ${blockerCodes.join(', ') || 'workflow lane'}.`
    const alertId = stringValue(payload.alert?.id) || item.id
    const replayCount = numberValue(payload.alert?.replayCount)
    const replayedAt = stringValue(payload.alert?.lastReplayedAt || payload.alert?.updatedAt)
    const countText = replayCount !== undefined ? `; replay count ${replayCount}` : ''
    const timeText = replayedAt ? `; latest ${replayedAt}` : ''
    return `Evidence replay recorded for ${alertId}${countText}${timeText}.`
}

export function sourceOperationsActionMessage(payload: Record<string, unknown>) {
    const sourceOperationsReadiness = objectValue(payload.sourceOperationsReadiness)
        || objectValue(objectValue(payload.sourcePacks)?.sourceOperationsReadiness)
        || objectValue(objectValue(objectValue(payload.sourceInventory)?.sourcePackWorker)?.sourceOperationsReadiness)
    const sourceOperationsQueue = objectValue(payload.sourceOperationsQueue)
        || objectValue(objectValue(payload.actorReadiness)?.sourceOperationsQueue)
        || objectValue(objectValue(objectValue(payload.statusArtifacts)?.dashboardSourceReadiness)?.sourceOperationsQueue)
    const sourceOperationsAdapter = objectValue(payload.sourceOperationsAdapter)
        || objectValue(objectValue(objectValue(payload.statusArtifacts)?.dashboardSourceReadiness)?.sourceOperationsAdapter)
    const collectionTrigger = objectValue(payload.collectionTrigger)
    const alertRebuild = objectValue(payload.alertRebuild)
    const queueItems = arrayValue(sourceOperationsQueue?.queueItems)
    const adapterRows = arrayValue(sourceOperationsAdapter?.rows)

    if (sourceOperationsReadiness) {
        const summary = objectValue(sourceOperationsReadiness.summary) || {}
        const actionability = objectValue(sourceOperationsReadiness.actionability)
        const nextAction = objectValue(arrayValue(sourceOperationsReadiness.nextOperatorActions)[0])
        const lastActionId = stringArrayValue(sourceOperationsReadiness.lastActionIds)[0]
        const parts = [
            numberValue(summary.readyFamilies) !== undefined ? `${numberValue(summary.readyFamilies)} ready families` : undefined,
            numberValue(summary.actionableFamilies) !== undefined ? `${numberValue(summary.actionableFamilies)} actionable families` : undefined,
            numberValue(summary.candidateCount) !== undefined ? `${numberValue(summary.candidateCount)} candidates` : undefined,
            queueItems.length ? `${queueItems.length} scheduled operation${queueItems.length === 1 ? '' : 's'}` : undefined,
            lastActionId ? `last action ${lastActionId}` : undefined,
        ].filter(Boolean)
        const next = [stringValue(nextAction?.action), stringValue(nextAction?.reason)].filter(Boolean).join(': ')
        const retry = actionability?.canRetry === false ? ' Retry is paused by source policy.' : ''
        return `Collection updated${parts.length ? `: ${parts.join(', ')}` : '.'}${next ? `. Next: ${next}` : ''}${retry}`
    }

    if (queueItems.length) return `Collection has ${queueItems.length} item${queueItems.length === 1 ? '' : 's'} for review.`
    if (adapterRows.length) return `Collection published ${adapterRows.length} dashboard row${adapterRows.length === 1 ? '' : 's'}.`

    const collectionQueued = collectionTrigger?.queued === true
    const collectionReason = stringValue(collectionTrigger?.reason)
    const collectionTaskId = stringValue(collectionTrigger?.taskId) || stringValue(collectionTrigger?.jobId)
    const rebuildStatus = stringValue(alertRebuild?.status)
    const rebuildReason = stringValue(alertRebuild?.reason)
    if (collectionTrigger || alertRebuild) {
        const collectionText = collectionQueued
            ? `collection scheduled${collectionTaskId ? ` as ${collectionTaskId}` : ''}`
            : `collection waiting${collectionReason ? `: ${collectionReason}` : ''}`
        const rebuildText = rebuildStatus || rebuildReason
            ? `alert rebuild ${rebuildStatus || 'pending'}${rebuildReason ? `: ${rebuildReason}` : ''}`
            : 'alert rebuild state updated'
        return `Source workflow updated: ${collectionText}; ${rebuildText}.`
    }

    return undefined
}

export function caseMutationResultMessage(action: WorkbenchCaseMutationAction, payload: Awaited<ReturnType<typeof readJson>>) {
    const caseId = payload.case?.id ? `Case ${payload.case.id}` : 'Case'
    const status = payload.case?.status ? ` is ${payload.case.status}` : ' updated'
    if (action === 'assign') return `${caseId} owner saved.`
    if (action === 'note') return `${caseId} rationale saved.`
    if (action === 'review') return `${caseId}${status}; review started.`
    if (action === 'escalate') return `${caseId}${status} and ready for routing.`
    if (action === 'suppress') return `${caseId}${status}; delivery muted.`
    if (action === 'close') return `${caseId}${status}.`
    if (action === 'reopen') return `${caseId} reopened.`
    if (action === 'false_positive') return `${caseId} marked false positive.`
    return `${caseId}${status}.`
}

export function caseMutationIdempotencyKey(item: WorkbenchCase, mutation: CaseMutationInput) {
    const owner = mutation.assignedOwner || 'unassigned'
    const note = (mutation.note || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 96)
    return `workbench:${item.id}:${mutation.action}:${owner}:${note || 'no-note'}`
}

export function scopeBody(orgContext: WorkbenchOrgContext | undefined) {
    if (orgContext?.scope.organizationId) return { organizationId: orgContext.scope.organizationId }
    return { tenantId: orgContext?.scope.tenantId || 'default' }
}
