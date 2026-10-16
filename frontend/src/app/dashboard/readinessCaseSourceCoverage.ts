import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { readinessCase } from './readinessCaseFactory'
import { sourceInventoryHref } from './readinessCaseLinks'
import { derivedWatchlistMatchCount } from './operatorContextUtils'

export function buildSourceCoverageCase(context: ReadinessCaseContext): WorkbenchCase {
    const { input, now, organization, activeOrgMembers, pendingOrgInvites, orgWebhooks, activeWatchlists, watchlistTerms, webhookWatchlists, hasWebhookDestination, activeSources, sourceCount, latestDelivery, deliveryFailures, orgWebhookFailures, alertVisibilityBlocked, alertAccessMessage, helpdeskAudit, helpdeskBlockers, helpdeskReady, helpdeskCheckedAt, helpdeskAuditCount, helpdeskQueueDepth, analystWorkflow, analystWorkflowReady, analystWorkflowCheckedAt, analystWorkflowBlockers, sourceGrowth, sourceWorkerReady, sourceWorkerCheckedAt, sourceWorkerBlockers, alertGenerationProof, alertGenerationProofBlockers, alertGenerationCandidateCount, alertGenerationDashboardBlockers, alertGenerationProofReady, alertGenerationProofCheckedAt, path } = context
    return readinessCase({
            id: 'source_coverage',
            kind: 'source_readiness',
            queue: 'Source coverage',
            title: sourceCount ? 'Source coverage lane active' : 'Open source coverage lane',
            severity: sourceCount && activeSources ? 'medium' : 'high',
            status: sourceCount && activeSources ? 'collecting' : 'missing_sources',
            priority: sourceCount && activeSources ? 245 : 360,
            confidence: input.operations ? 88 : 60,
            subtitle: input.operations ? `${activeSources}/${sourceCount} sources active. Latest run: ${input.operations.latestRun?.status || 'checking'}.` : 'DWM operations source inventory is syncing for this dashboard.',
            recommendedAction: sourceCount && activeSources ? 'Keep source health above threshold and run collection after watchlist changes.' : 'Approve public Telegram and safe-field dark web sources before promising alert coverage.',
            evidence: [{
                id: 'ev_source_coverage',
                sourceName: 'DWM collection',
                sourceFamily: 'source health',
                captureMode: 'operator view',
                redactionState: 'customer safe',
                contentHash: input.operations?.latestRun?.updatedAt || 'dwm.operations',
                excerpt: input.operations ? `${input.operations.counts.captureCount} captures, ${derivedWatchlistMatchCount(input.operations)} watchlist matches.` : 'Source-health operations are syncing.',
                observedAt: input.operations?.latestRun?.updatedAt || now,
                provenance: 'DWM operations ledger',
                confidence: input.operations ? 88 : 60,
            }],
            timeline: [{ id: 'source_health_at', at: input.operations?.latestRun?.updatedAt || now, title: input.operations?.latestRun ? 'Latest collection run' : 'Source coverage syncing', body: input.operations?.latestRun ? `${input.operations.latestRun.status}: ${input.operations.latestRun.captureCount} captures.` : 'Source coverage is syncing to the TI scraper connection.' }],
            nextTasks: [`Owner: collection. Active sources: ${activeSources}/${sourceCount}.`, 'Approve bounded public Telegram coverage.', 'Approve safe-field dark web source coverage.'],
            relatedLinks: [{ href: '/findings', label: 'Run collection' }, { href: '/ti/sources', label: 'Review sources' }, { href: sourceInventoryHref(input.scope), label: 'Source inventory API' }],
            workflowPath: path,
            actions: [
                {
                    id: 'inspect_source_inventory',
                    label: 'Inspect source inventory',
                    method: 'GET',
                    href: sourceInventoryHref(input.scope),
                },
                {
                    id: 'run_canary_collection',
                    label: 'Run canary',
                    method: 'POST',
                    href: '/api/findings/canary/run',
                    body: {
                        operatorApproval: true,
                        approvedBy: 'dashboard',
                        maxSources: 12,
                        maxTasks: 24,
                    },
                },
            ],
        })
}
