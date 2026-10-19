import type { WorkbenchEvidence } from './evidence'
import type { WorkbenchTimelineItem } from './evidence'
import type { WorkbenchWorkflowStep } from './evidence'
import type { WorkbenchAction } from './evidence'
import type { WorkbenchDeliveryEvidence } from './evidence'
import type { WorkbenchPublicTiHandoff } from './evidence'
import type { WorkbenchCaseMutationAction } from './evidence'
import type { CaseDetailPayload } from './caseDetail'

export type WorkbenchCase = {
    id: string
    kind: 'dwm_alert' | 'ti_domain' | 'source_capture' | 'org_readiness' | 'watchlist_readiness' | 'webhook_readiness' | 'source_readiness' | 'alert_readiness' | 'public_ti_handoff'
    queue: string
    title: string
    subtitle: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    priority: number
    confidence: number
    owner: string
    createdAt: string
    updatedAt: string
    company: string
    matchedTerm: string
    actor: string
    sourceLabel: string
    recommendedAction: string
    routeLabel: string
    persistent: boolean
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: Array<{ href: string, label: string }>
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    caseDetailHref?: string
    deliveryEvidence?: WorkbenchDeliveryEvidence[]
    missingDependency?: string
    handoff?: WorkbenchPublicTiHandoff
}

export type QueueFilter = 'all' | 'critical' | 'high' | 'persistent' | 'evidence'

export type CaseMutationInput = {
    action: WorkbenchCaseMutationAction
    note?: string
    assignedOwner?: string
}

export type LocalDecision = {
    status?: string
    owner?: string
    reason?: string
    decidedAt?: string
}

export type CaseDetailState =
    | { status: 'loading' }
    | { status: 'ready', detail: CaseDetailPayload }
    | { status: 'error', error: string }

export type CaseVisibilityDecision = {
    allowed: boolean
    reason: string | null
    alertVisibilityPolicy: 'members' | 'admins' | 'owners'
    allowedRoles: string[]
}

export type CaseWatchlist = {
    id: string
    organizationId?: string
    tenantId: string
    name: string
    status: string
    webhookDestinationId?: string
    hasWebhookUrl?: boolean
    matchedTerms?: Array<{ value?: string, kind?: string }>
    termCount?: number
}

export type CaseAllowedAction = {
    id: WorkbenchCaseMutationAction | 'deliver_webhook'
    label: string
    method: 'PATCH' | 'POST'
    requiresRationale?: boolean
    enabled: boolean
    disabledReason?: string
}

export type CaseDelivery = WorkbenchDeliveryEvidence & {
    dryRun?: boolean
}

export type CaseCustomerNotificationReceipt = {
    id: string
    at: string
    deliveryMode: 'webhook_delivery' | 'manual_handoff'
    rationale?: string
    webhookDeliveryId?: string
    webhookDestinationId?: string
    webhookStatus?: string
    externalReference?: string
}

export type CaseEvidence = {
    id: string
    sourceName?: string
    redactionState?: string
    contentHash?: string
    excerpt?: string
}

export type CaseTimelineItem = {
    id: string
    at: string
    title: string
    detail: string
    eventType?: string
    actor?: string
    rationale?: string
    fromStatus?: string
    toStatus?: string
    fromOwner?: string
    toOwner?: string
}

export type CaseWorkflowEvent = {
    id: string
    at: string
    actor?: string
    action: string
    fromStatus?: string
    toStatus?: string
    fromOwner?: string
    toOwner?: string
    note?: string
}
