import type { WorkbenchEvidence, WorkbenchTimelineItem, WorkbenchWorkflowStep } from './ti/workbench/workbenchClient'
import { sanitizeVisibleOperatorCopy } from '@/utils/productProgress/readinessLabels'

export function sanitizeWorkbenchEvidence(item: WorkbenchEvidence): WorkbenchEvidence {
    return {
        ...item,
        sourceName: sanitizeVisibleOperatorCopy(item.sourceName) || item.sourceName,
        sourceFamily: sanitizeVisibleOperatorCopy(item.sourceFamily) || item.sourceFamily,
        captureMode: sanitizeVisibleOperatorCopy(item.captureMode) || item.captureMode,
        redactionState: sanitizeVisibleOperatorCopy(item.redactionState) || item.redactionState,
        contentHash: sanitizeVisibleOperatorCopy(item.contentHash) || item.contentHash,
        excerpt: sanitizeVisibleOperatorCopy(item.excerpt) || item.excerpt,
        provenance: sanitizeVisibleOperatorCopy(item.provenance),
        metadata: item.metadata?.map(entry => ({
            label: sanitizeVisibleOperatorCopy(entry.label) || entry.label,
            value: sanitizeVisibleOperatorCopy(entry.value) || entry.value,
        })),
    }
}

export function sanitizeWorkbenchTimelineItem(item: WorkbenchTimelineItem): WorkbenchTimelineItem {
    return {
        ...item,
        title: sanitizeVisibleOperatorCopy(item.title) || item.title,
        body: sanitizeVisibleOperatorCopy(item.body) || item.body,
    }
}

export function sanitizeWorkbenchWorkflowStep(item: WorkbenchWorkflowStep): WorkbenchWorkflowStep {
    return {
        ...item,
        label: sanitizeVisibleOperatorCopy(item.label) || item.label,
        owner: sanitizeVisibleOperatorCopy(item.owner) || item.owner,
        source: sanitizeVisibleOperatorCopy(item.source) || item.source,
        detail: sanitizeVisibleOperatorCopy(item.detail) || item.detail,
        entityId: sanitizeVisibleOperatorCopy(item.entityId),
    }
}

