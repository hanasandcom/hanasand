import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import { alertGenerationDetail } from '@/utils/productProgress/readinessDetails'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { sanitizeVisibleOperatorCopy, visibleChecks } from '@/utils/productProgress/readinessLabels'
import { readinessCase } from './readinessCaseFactory'
import { alertsHref } from './readinessCaseLinks'
import { actionScope } from './operatorContextUtils'

export function buildAlertGenerationCase(context: ReadinessCaseContext): WorkbenchCase {
    const { input, now, organization, activeOrgMembers, pendingOrgInvites, orgWebhooks, activeWatchlists, watchlistTerms, webhookWatchlists, hasWebhookDestination, activeSources, sourceCount, latestDelivery, deliveryFailures, orgWebhookFailures, alertVisibilityBlocked, alertAccessMessage, helpdeskAudit, helpdeskBlockers, helpdeskReady, helpdeskCheckedAt, helpdeskAuditCount, helpdeskQueueDepth, analystWorkflow, analystWorkflowReady, analystWorkflowCheckedAt, analystWorkflowBlockers, sourceGrowth, sourceWorkerReady, sourceWorkerCheckedAt, sourceWorkerBlockers, alertGenerationProof, alertGenerationProofBlockers, alertGenerationCandidateCount, alertGenerationDashboardBlockers, alertGenerationProofReady, alertGenerationProofCheckedAt, path } = context
    return readinessCase({
            id: 'alert_generation',
            kind: 'alert_readiness',
            queue: alertVisibilityBlocked ? 'Org access' : 'Alert generation',
            title: alertVisibilityBlocked ? 'Confirm DWM org visibility' : alertGenerationProofReady && input.liveAlertCount ? 'Alert stream live' : alertGenerationProof ? 'Alert stream checking evidence' : input.liveAlertCount ? 'DWM alerts live' : 'Alert stream checking',
            severity: alertVisibilityBlocked ? 'low' : alertGenerationProofReady && input.liveAlertCount ? 'medium' : input.liveAlertCount ? 'medium' : 'high',
            status: alertVisibilityBlocked ? 'setup_check' : alertGenerationProof ? alertGenerationProofReady ? 'ready' : 'needs_action' : input.liveAlertCount ? 'alerts_ready' : 'checking',
            priority: alertVisibilityBlocked ? 230 : alertGenerationProofReady && input.liveAlertCount ? 238 : input.liveAlertCount ? 240 : 350,
            confidence: alertVisibilityBlocked ? 86 : alertGenerationProof ? alertGenerationProofReady ? 92 : 72 : input.liveAlertCount ? 90 : 58,
            subtitle: alertVisibilityBlocked
                ? `${alertAccessMessage} analyst process remains inspectable; live customer delivery waits for membership visibility.`
                : alertGenerationProof
                    ? alertGenerationProof.detail || alertGenerationDetail(alertGenerationProof)
                    : input.liveAlertCount ? `${input.liveAlertCount} saved DWM alert${input.liveAlertCount === 1 ? '' : 's'} ready.` : 'Alert state is updating to saved DWM alerts and source captures.',
            recommendedAction: alertVisibilityBlocked
                ? 'Open organization access, confirm the signed-in operator is an active member, then reload live DWM alerts.'
                : alertGenerationProofReady && input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : alertGenerationProof ? 'Open alert generation, review held checks, then deliver only customer-safe rows.' : input.liveAlertCount ? 'Work the ready alerts, open cases, replay evidence, and deliver customer notifications.' : 'Save watchlist terms, collect sources, and rebuild alerts so customer rows fill in.',
            evidence: [{
                id: 'ev_alert_generation',
                sourceName: alertGenerationProof ? 'DWM alert generation' : 'DWM alert stream',
                sourceFamily: 'alert workflow',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: alertGenerationProof?.backendProofContractVersion || input.alertAccessState?.code || 'dwm.alerts',
                excerpt: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProof
                    ? alertGenerationProofReady
                        ? `${alertGenerationProof.candidateCount ?? 0} candidate${alertGenerationProof.candidateCount === 1 ? '' : 's'}; ${alertGenerationProof.generationEvidenceWindowCaptureCount ?? 0} evidence-window capture${alertGenerationProof.generationEvidenceWindowCaptureCount === 1 ? '' : 's'}.`
                        : sanitizeVisibleOperatorCopy(visibleChecks(alertGenerationDashboardBlockers) || alertGenerationProof.unavailableReason || 'Alert generation is checking source evidence and delivery routes.') || 'Alert generation is checking source evidence and delivery routes.'
                    : input.liveAlertCount ? 'Alerts are live for the selected workspace.' : 'Alert state is updating for saved DWM alerts.',
                observedAt: alertGenerationProofCheckedAt,
                provenance: alertGenerationProof?.source || 'DWM alert stream and rebuild worker',
                confidence: alertVisibilityBlocked ? 86 : alertGenerationProof ? alertGenerationProofReady ? 92 : 72 : input.liveAlertCount ? 90 : 58,
            }],
            timeline: [{ id: 'alert_generation_at', at: alertGenerationProofCheckedAt, title: alertVisibilityBlocked ? 'Organization access check running' : alertGenerationProofReady ? 'Alert generation linked' : input.liveAlertCount ? 'Recent alerts active' : 'Alert generation checking', body: alertVisibilityBlocked ? alertAccessMessage : alertGenerationProof ? alertGenerationProofReady ? `${alertGenerationProof.candidateCount ?? 0} alert candidate${alertGenerationProof.candidateCount === 1 ? '' : 's'} with latest evidence ${alertGenerationProof.latestEvidenceAt || 'checking'}.` : sanitizeVisibleOperatorCopy(visibleChecks(alertGenerationDashboardBlockers) || alertGenerationProof.unavailableReason || 'Alert generation is checking source evidence and delivery routes.') || 'Alert generation is checking source evidence and delivery routes.' : input.liveAlertCount ? 'Saved alerts are ready for triage.' : 'Alert rebuild is checking active watchlist terms and source captures.' }],
            nextTasks: alertVisibilityBlocked
                ? ['Owner: operator. Match this dashboard session to an active organization member.', 'Retry DWM alerts after the organization identity is fixed.', 'Use tenant-default rows only for workflow review until org visibility succeeds.']
                : alertGenerationProofReady && input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.']
                    : alertGenerationProof ? ['Owner: DWM owner. Open alert generation status.', 'Review candidate, evidence-window, source, and webhook-route checks.', 'Rebuild alerts after customer delivery data is healthy.']
                        : input.liveAlertCount ? [`Owner: analyst. Case candidates: ${input.liveAlertCount}.`, 'Select a DWM alert and open/update its backed analyst case.', 'Send only after webhook destination test succeeds.'] : ['Owner: operator. Save watchlist.', 'Run collection.', 'Rebuild alerts.'],
            relatedLinks: alertVisibilityBlocked
                ? [{ href: '/organizations', label: 'Organization access' }, { href: alertsHref(input.scope), label: 'organization alerts' }]
                : [{ href: '/findings', label: 'Rebuild alerts' }, { href: alertsHref(input.scope), label: 'Alerts API' }, { href: '/api/findings/alerts/generation-readiness', label: 'Generation status' }],
            workflowPath: path,
            missingDependency: alertVisibilityBlocked ? undefined : alertGenerationProofReady && input.liveAlertCount ? undefined : alertGenerationProof ? sanitizeVisibleOperatorCopy(visibleChecks(alertGenerationDashboardBlockers) || alertGenerationProof.unavailableReason || 'Alert generation is checking source evidence and delivery routes.') : input.liveAlertCount ? undefined : 'Alert stream is checking saved DWM alerts before customer delivery.',
            actions: [
                ...(alertVisibilityBlocked ? [{
                    id: 'open_organization_access',
                    label: 'Open organization access',
                    method: 'GET' as const,
                    href: '/organizations',
                }] : []),
                { id: 'open_alert_queue', label: alertVisibilityBlocked ? 'Retry organization alerts' : 'Open alerts', method: 'GET', href: alertsHref(input.scope) },
                ...(!alertVisibilityBlocked ? [{ id: 'open_alert_generation_readiness', label: 'Open generation status', method: 'GET' as const, href: '/api/findings/alerts/generation-readiness' }] : []),
                ...(!alertVisibilityBlocked && activeWatchlists.length ? [{
                    id: 'rebuild_alerts',
                    label: 'Rebuild alerts',
                    method: 'POST' as const,
                    href: '/api/findings/alerts/rebuild',
                    body: actionScope(input.scope),
                }] : []),
            ],
        })
}
