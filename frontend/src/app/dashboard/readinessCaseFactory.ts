import type { WorkbenchAction, WorkbenchCase, WorkbenchEvidence, WorkbenchTimelineItem, WorkbenchWorkflowStep } from './ti/workbench/workbenchClient'
import { sanitizeVisibleOperatorCopy } from '@/utils/productProgress/readinessLabels'
import { sanitizeWorkbenchEvidence, sanitizeWorkbenchTimelineItem, sanitizeWorkbenchWorkflowStep } from './readinessCaseSanitizers'

export function readinessCase(input: {
    id: string
    kind: WorkbenchCase['kind']
    queue: string
    title: string
    severity: WorkbenchCase['severity']
    status: string
    priority: number
    confidence: number
    subtitle: string
    recommendedAction: string
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: WorkbenchCase['relatedLinks']
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    deliveryEvidence?: WorkbenchCase['deliveryEvidence']
    caseDetailHref?: WorkbenchCase['caseDetailHref']
    missingDependency?: string
}): WorkbenchCase {
    const updatedAt = input.evidence[0]?.observedAt || new Date().toISOString()
    const evidence = input.evidence.map(sanitizeWorkbenchEvidence)
    const timeline = input.timeline.map(sanitizeWorkbenchTimelineItem)

    return {
        id: input.id,
        kind: input.kind,
        queue: sanitizeVisibleOperatorCopy(input.queue) || input.queue,
        title: sanitizeVisibleOperatorCopy(input.title) || input.title,
        subtitle: sanitizeVisibleOperatorCopy(input.subtitle) || input.subtitle,
        severity: input.severity,
        status: sanitizeVisibleOperatorCopy(input.status) || input.status,
        priority: input.priority,
        confidence: input.confidence,
        owner: input.kind === 'org_readiness' && input.status !== 'org_active' ? 'platform' : 'operator',
        createdAt: updatedAt,
        updatedAt,
        company: 'Hanasand DWM',
        matchedTerm: sanitizeVisibleOperatorCopy(input.queue) || input.queue,
        actor: 'Operations control',
        sourceLabel: evidence[0]?.sourceName || 'Dashboard control',
        recommendedAction: sanitizeVisibleOperatorCopy(input.recommendedAction) || input.recommendedAction,
        routeLabel: (sanitizeVisibleOperatorCopy(input.queue) || input.queue).toLowerCase(),
        persistent: input.kind !== 'org_readiness',
        evidence,
        timeline,
        nextTasks: input.nextTasks.map(task => sanitizeVisibleOperatorCopy(task) || task),
        relatedLinks: input.relatedLinks,
        workflowPath: input.workflowPath?.map(sanitizeWorkbenchWorkflowStep),
        actions: input.actions,
        deliveryEvidence: input.deliveryEvidence,
        caseDetailHref: input.caseDetailHref,
        missingDependency: sanitizeVisibleOperatorCopy(input.missingDependency),
    }
}

