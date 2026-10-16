import { type AnalystWorkItem, type DecisionStep, type EnrichmentTask, type LocalDecision, type LocalRelevanceMark, type StagedHandoff } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'

export function taskStatusLabel(status: EnrichmentTask['status']) {
    if (status === 'needs_api') return 'source question'
    if (status === 'needs_review') return 'review'
    if (status === 'watch') return 'watchlist'
    return 'ready'
}

export function taskStatusClass(status: EnrichmentTask['status']) {
    if (status === 'ready') return 'rounded-lg border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (status === 'watch') return 'rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'
    if (status === 'needs_review') return 'rounded-lg border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'rounded-lg border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

export function decisionStepStatusLabel(status: DecisionStep['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'review') return 'review'
    return 'syncing'
}

export function decisionStepStatusClass(status: DecisionStep['status']) {
    if (status === 'ready') return 'shrink-0 rounded-md border border-ui-success/35 bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (status === 'review') return 'shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

export function severityClass(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 'border border-ui-danger/35 bg-ui-raised/10 text-ui-text dark:border-ui-danger/35 dark:bg-ui-raised/10 dark:text-ui-text'
    if (severity === 'high') return 'border border-ui-warning/35 bg-ui-raised/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    if (severity === 'medium') return 'border border-ui-warning/35 bg-ui-warning/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'border border-ui-success/35 bg-ui-success/10 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
}

export function severityWeight(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 4
    if (severity === 'high') return 3
    if (severity === 'medium') return 2
    return 1
}

export function kindLabel(kind: AnalystWorkItem['kind']) {
    if (kind === 'exposure') return 'Recent attacks'
    if (kind === 'victim') return 'Victim context'
    if (kind === 'tradecraft') return 'Tradecraft'
    if (kind === 'collection') return 'Collection'
    return 'Activity'
}

export function assertionKindLabel(kind: AnalystWorkItem['assertionKind']) {
    if (kind === 'observed') return 'Observed fact'
    if (kind === 'inferred') return 'Inferred candidate'
    if (kind === 'extracted') return 'Extracted field'
    return 'Source claim'
}

export function decisionLabel(status: LocalDecision['status']) {
    if (status === 'reviewing') return 'Reviewing'
    if (status === 'assigned') return 'Assigned'
    if (status === 'escalated') return 'Escalated'
    if (status === 'suppressed') return 'Suppressed'
    if (status === 'reopened') return 'Reopened'
    return 'Closed'
}

export function relevanceLabel(status: LocalRelevanceMark['state']) {
    if (status === 'customer_relevant') return 'customer'
    if (status === 'context_only') return 'context'
    if (status === 'needs_source') return 'source review'
    return 'not relevant'
}

export function relevanceLabelForStaged(status: StagedHandoff['relevanceState']) {
    if (status === 'not_marked') return 'unmarked'
    return relevanceLabel(status)
}

export function readinessOwnerLabel(owner: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']) {
    if (owner === 'public-ti') return 'Analyst review'
    if (owner === 'org') return 'Organization'
    if (owner === 'alert') return 'Alert actions'
    if (owner === 'case') return 'Case actions'
    if (owner === 'webhook') return 'Webhook delivery'
    if (owner === 'entitlement') return 'Entitlement'
    return 'Source collection'
}

export function defaultDecisionReason(status: LocalDecision['status']) {
    if (status === 'reviewing') return 'Review started in the public TI workspace.'
    if (status === 'assigned') return 'Assigned locally for follow-up.'
    if (status === 'escalated') return 'Escalated for customer or incident-response review.'
    if (status === 'suppressed') return 'Suppressed as low-value, duplicate, or false positive.'
    if (status === 'reopened') return 'Reopened for another look.'
    return 'Closed in the local TI workspace.'
}

export function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

export function captureReferenceLabel(value?: string | null) {
    return value ? 'capture reference linked' : 'capture reference needed'
}

export function sourceReferenceCountLabel(sourceIds: string[], fallback: string) {
    if (sourceIds.length) return `${sourceIds.length} source reference${sourceIds.length === 1 ? '' : 's'} linked`
    return fallback
}

export function publicStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'action_required') return 'reviewing'
    if (value === 'review') return 'reviewing'
    if (value === 'local') return 'local'
    return formatLabel(value)
}

export function publicDecisionStatusLabel(value: DecisionStep['status']) {
    if (value === 'blocked') return 'syncing'
    return decisionStepStatusLabel(value)
}
