import type { ProductReadinessExternalState } from '@/utils/productProgress/sourceGrowthTypes'
import type { DwmAlertAccessState, DwmDeliveryItem, DwmOperationsSnapshot, DwmOrganizationState, DwmWatchlistSummary, OperatorScope } from './operatorConsoleTypes'
import { sourceGrowthReady } from '@/utils/productProgress/readinessDetails'
import { unavailableAnalystWorkflow } from '@/utils/productProgress/readinessFallbacks'
import { buildSourceProofReadinessFromProxy } from '@/utils/productProgress/sourceProof'
import { operatorPath } from './readinessCaseLinks'

export type ReadinessCasesInput = {
    backendConfigured: boolean
    scope: OperatorScope
    watchlists: DwmWatchlistSummary[]
    operations: DwmOperationsSnapshot | null
    deliveries: DwmDeliveryItem[]
    organizationState: DwmOrganizationState
    liveAlertCount: number
    renderedAlertCount: number
    alertAccessState?: DwmAlertAccessState
    externalReadiness?: ProductReadinessExternalState
}

export function createReadinessCaseContext(input: ReadinessCasesInput) {
    const now = new Date().toISOString()
    const organization = input.organizationState.selectedOrganization
    const activeOrgMembers = input.organizationState.members.filter(member => member.status === 'active')
    const pendingOrgInvites = input.organizationState.pendingInvites.filter(invite => invite.status === 'pending')
    const orgWebhooks = input.organizationState.webhooks.filter(item => item.status === 'active')
    const activeWatchlists = input.watchlists.filter(item => item.status === 'active')
    const watchlistTerms = activeWatchlists.flatMap(item => item.terms || [])
    const webhookWatchlists = activeWatchlists.filter(item => item.webhookUrl || item.webhookDestinationId)
    const hasWebhookDestination = Boolean(orgWebhooks.length || webhookWatchlists.length)
    const activeSources = input.operations?.counts.activeSourceCount ?? 0
    const sourceCount = input.operations?.counts.sourceCount ?? 0
    const latestDelivery = input.deliveries[0]
    const deliveryFailures = input.deliveries.filter(item => item.status === 'failed' || item.status === 'skipped').length
    const orgWebhookFailures = orgWebhooks.filter(item => item.lastTestStatus === 'failed').length
    const alertVisibilityBlocked = input.alertAccessState?.status === 'identity_missing' || input.alertAccessState?.status === 'visibility_denied'
    const alertAccessMessage = input.alertAccessState?.message || (input.alertAccessState?.status === 'identity_missing'
        ? 'DWM alert access requires an active organization member identity.'
        : 'DWM alert visibility could not be verified for this organization scope.')
    const helpdeskAudit = input.externalReadiness?.helpdeskAudit
    const helpdeskBlockers = helpdeskAudit?.blockers?.filter(Boolean) || []
    const helpdeskReady = helpdeskAudit?.status === 'ready'
    const helpdeskCheckedAt = helpdeskAudit?.checkedAt || helpdeskAudit?.latestAuditEventAt || helpdeskAudit?.proofTimestamp || now
    const helpdeskAuditCount = typeof helpdeskAudit?.auditedActions === 'number' ? helpdeskAudit.auditedActions : 0
    const helpdeskQueueDepth = typeof helpdeskAudit?.supportQueueDepth === 'number'
        ? helpdeskAudit.supportQueueDepth
        : typeof helpdeskAudit?.openRecoveryRequests === 'number'
            ? helpdeskAudit.openRecoveryRequests
            : 0
    const analystWorkflow = input.externalReadiness?.analystWorkflow || unavailableAnalystWorkflow('External readiness unavailable', now)
    const analystWorkflowReady = analystWorkflow?.status === 'ready'
    const analystWorkflowCheckedAt = analystWorkflow?.checkedAt || analystWorkflow?.latestCaseAt || analystWorkflow?.proofTimestamp || now
    const analystWorkflowBlockers = analystWorkflow?.blockers?.filter(Boolean) || []
    const sourceGrowth = input.externalReadiness?.sourceGrowth || buildSourceProofReadinessFromProxy(null, { route: '/api/ti/scraper/control', checkedAt: now })
    const sourceWorkerReady = sourceGrowthReady(sourceGrowth)
    const sourceWorkerCheckedAt = sourceGrowth?.checkedAt || sourceGrowth?.workerLastRunAt || sourceGrowth?.latestInventoryAt || sourceGrowth?.proofTimestamp || now
    const sourceWorkerBlockers = sourceGrowth?.blockers?.filter(Boolean) || []
    const alertGenerationProof = input.externalReadiness?.alertGeneration
    const alertGenerationProofBlockers = alertGenerationProof?.blockers?.filter(Boolean) || []
    const alertGenerationCandidateCount = alertGenerationProof?.candidateCount ?? alertGenerationProof?.matchedCandidateCount ?? 0
    const alertGenerationDashboardBlockers = [
        ...alertGenerationProofBlockers,
        alertGenerationProof && alertGenerationCandidateCount <= 0 ? 'Alert generation returned no alert candidates.' : '',
        alertGenerationProof && alertGenerationProof.generationEvidenceWindowReady !== true ? 'Alert generation is missing evidence-window timestamps.' : '',
    ].filter(Boolean)
    const alertGenerationProofReady = alertGenerationProof?.status === 'ready' && alertGenerationCandidateCount > 0 && alertGenerationProof.generationEvidenceWindowReady === true && !alertGenerationDashboardBlockers.length
    const alertGenerationProofCheckedAt = alertGenerationProof?.checkedAt || alertGenerationProof?.latestEvidenceAt || alertGenerationProof?.proofTimestamp || now
    const path = operatorPath({
        scope: input.scope,
        organization,
        activeWatchlists,
        orgWebhooks,
        sourceCount,
        activeSources,
        liveAlertCount: input.liveAlertCount,
        latestDelivery,
    })

    return { input, now, organization, activeOrgMembers, pendingOrgInvites, orgWebhooks, activeWatchlists, watchlistTerms, webhookWatchlists, hasWebhookDestination, activeSources, sourceCount, latestDelivery, deliveryFailures, orgWebhookFailures, alertVisibilityBlocked, alertAccessMessage, helpdeskAudit, helpdeskBlockers, helpdeskReady, helpdeskCheckedAt, helpdeskAuditCount, helpdeskQueueDepth, analystWorkflow, analystWorkflowReady, analystWorkflowCheckedAt, analystWorkflowBlockers, sourceGrowth, sourceWorkerReady, sourceWorkerCheckedAt, sourceWorkerBlockers, alertGenerationProof, alertGenerationProofBlockers, alertGenerationCandidateCount, alertGenerationDashboardBlockers, alertGenerationProofReady, alertGenerationProofCheckedAt, path }
}

export type ReadinessCaseContext = ReturnType<typeof createReadinessCaseContext>
