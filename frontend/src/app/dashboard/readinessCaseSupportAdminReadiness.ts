import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import { helpdeskAuditDetail } from '@/utils/productProgress/readinessDetails'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { visibleChecks } from '@/utils/productProgress/readinessLabels'
import { readinessCase } from './readinessCaseFactory'

export function buildSupportAdminReadinessCase(context: ReadinessCaseContext): WorkbenchCase {
    const { helpdeskAudit, helpdeskBlockers, helpdeskReady, helpdeskCheckedAt, helpdeskAuditCount, helpdeskQueueDepth, path } = context
    return readinessCase({
        id: 'support_admin_readiness',
        kind: 'support_readiness',
        queue: 'Support ops',
        title: helpdeskReady ? 'Support audit lane active' : 'Open support audit lane',
        severity: helpdeskReady ? 'medium' : 'high',
        status: helpdeskAudit?.status || 'unavailable',
        priority: helpdeskReady ? 248 : 365,
        confidence: helpdeskAudit ? 88 : 55,
        subtitle: helpdeskAudit
            ? helpdeskAudit.detail || helpdeskAuditDetail(helpdeskAudit)
            : 'Support recovery and admin audit lanes are syncing.',
        recommendedAction: helpdeskReady
            ? 'Review the audited support queue before closing customer access issues.'
            : 'Open the helpdesk workbench and confirm support recovery plus admin audit export.',
        evidence: [{
            id: 'ev_support_audit_readiness',
            sourceName: 'Support audit trail',
            sourceFamily: 'admin support',
            captureMode: 'operator view',
            redactionState: 'customer safe',
            contentHash: helpdeskAudit?.backendProofContractVersion || helpdeskAudit?.schemaVersion || 'support.audit.readiness.v1',
            excerpt: helpdeskAudit
                ? `${helpdeskAuditCount} audited support action${helpdeskAuditCount === 1 ? '' : 's'}; ${helpdeskQueueDepth} recovery request${helpdeskQueueDepth === 1 ? '' : 's'}.`
                : 'Support recovery and admin audit evidence is syncing.',
            observedAt: helpdeskCheckedAt,
            provenance: helpdeskAudit?.source || 'Support recovery and admin audit trail',
            confidence: helpdeskAudit ? 88 : 55,
        }],
        timeline: [{
            id: 'support_audit_readiness_at',
            at: helpdeskCheckedAt,
            title: helpdeskReady ? 'Support audit lane active' : 'Support audit lane checking',
            body: helpdeskReady
                ? `${helpdeskAuditCount} audited support action${helpdeskAuditCount === 1 ? '' : 's'} active with ${helpdeskQueueDepth} recovery request${helpdeskQueueDepth === 1 ? '' : 's'}.`
                : visibleChecks(helpdeskBlockers) || helpdeskAudit?.unavailableReason || 'Support access requires recovery requests and admin audit export.',
        }],
        nextTasks: helpdeskReady
            ? ['Owner: support ops. Review recovery requests that need approval.', 'Open the admin audit export before closing customer access issues.', 'Keep support actions auditable before customer rollout.']
            : ['Owner: support ops. Open the helpdesk workbench.', 'Verify recovery queue state from the backed support route.', 'Confirm admin audit export before marking support access ready.'],
        relatedLinks: [
            { href: '/helpdesk', label: 'Helpdesk workbench' },
            { href: '/api/backend/admin/support/access-recovery', label: 'Recovery queue' },
            { href: '/api/backend/admin/audit-events?limit=50', label: 'Admin audit' },
        ],
        workflowPath: path,
        missingDependency: helpdeskReady ? undefined : visibleChecks(helpdeskBlockers) || helpdeskAudit?.unavailableReason || 'Support recovery and admin audit data are syncing.',
        actions: [
            { id: 'open_helpdesk_workbench', label: 'Open helpdesk', method: 'GET', href: '/helpdesk' },
            { id: 'inspect_support_recovery', label: 'Inspect recovery', method: 'GET', href: '/api/backend/admin/support/access-recovery' },
            { id: 'inspect_admin_audit', label: 'Inspect audit', method: 'GET', href: '/api/backend/admin/audit-events?limit=50' },
        ],
    })
}
