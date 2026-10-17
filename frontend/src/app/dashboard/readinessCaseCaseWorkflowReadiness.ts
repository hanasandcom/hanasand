import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import { analystWorkflowDetail } from '@/utils/productProgress/readinessDetails'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { visibleChecks } from '@/utils/productProgress/readinessLabels'
import { readinessCase } from './readinessCaseFactory'

export function buildCaseWorkflowReadinessCase(context: ReadinessCaseContext): WorkbenchCase {
    const { analystWorkflow, analystWorkflowReady, analystWorkflowCheckedAt, analystWorkflowBlockers, path } = context
    return readinessCase({
        id: 'case_workflow_readiness',
        kind: 'alert_readiness',
        queue: 'Case workflow',
        title: analystWorkflowReady ? 'Case workflow lane active' : 'Open case workflow lane',
        severity: analystWorkflowReady ? 'medium' : 'high',
        status: analystWorkflow.status,
        priority: analystWorkflowReady ? 246 : 356,
        confidence: analystWorkflowReady ? 90 : 66,
        subtitle: analystWorkflow.detail || analystWorkflowDetail(analystWorkflow),
        recommendedAction: analystWorkflowReady
            ? 'Open the backed case, review timeline and evidence, then mutate case state from the selected detail.'
            : 'Link a readable analyst case to the dashboard-visible alert before treating workflow state as ready.',
        evidence: [{
            id: 'ev_analyst_workflow_readiness',
            sourceName: 'analyst process status',
            sourceFamily: 'case workflow',
            captureMode: 'operator view',
            redactionState: 'customer safe',
            contentHash: analystWorkflow.caseId || analystWorkflow.backendProofContractVersion || analystWorkflow.schemaVersion,
            excerpt: analystWorkflowReady
                ? `Case ${analystWorkflow.caseId || 'case syncing'} links to alert ${analystWorkflow.alertId || 'alert syncing'} with ${analystWorkflow.caseDetailTimelineCount ?? 0} timeline event${analystWorkflow.caseDetailTimelineCount === 1 ? '' : 's'}.`
                : visibleChecks(analystWorkflowBlockers) || analystWorkflow.unavailableReason || 'Analyst case workflow is syncing to live case data.',
            observedAt: analystWorkflowCheckedAt,
            provenance: analystWorkflow.source || 'Case list and selected case detail',
            confidence: analystWorkflowReady ? 90 : 66,
        }],
        timeline: [{
            id: 'analyst_workflow_readiness_at',
            at: analystWorkflowCheckedAt,
            title: analystWorkflowReady ? 'Case workflow linked' : 'Case workflow blocked',
            body: analystWorkflowReady
                ? `Case ${analystWorkflow.caseId || 'case syncing'} is linked to dashboard alert ${analystWorkflow.alertId || 'alert syncing'} and detail data is ${analystWorkflow.caseDetailReady ? 'ready' : 'syncing'}.`
                : visibleChecks(analystWorkflowBlockers) || analystWorkflow.unavailableReason || 'Readable case detail is syncing for the dashboard alert.',
        }],
        nextTasks: analystWorkflowReady
            ? [`Owner: analyst. Case ID: ${analystWorkflow.caseId || 'syncing'}.`, 'Open the selected case detail and review timeline evidence.', 'Use backed assign/note/escalate/suppress/close actions from the detail panel.']
            : ['Owner: SOC analyst. Create or link a case for the dashboard-visible alert.', 'Verify the selected case opens with timeline and allowed actions.', 'Return after the case workflow is backed by live case data.'],
        relatedLinks: [
            { href: analystWorkflow.href || '/ti/workbench', label: 'Recent attacks' },
            { href: analystWorkflow.caseDetailRoute || (analystWorkflow.caseId ? `/api/cases/${encodeURIComponent(analystWorkflow.caseId)}` : '/api/cases'), label: 'Case detail' },
            { href: '/dashboard', label: 'Dashboard evidence' },
        ],
        workflowPath: path,
        caseDetailHref: analystWorkflow.caseDetailRoute,
        missingDependency: analystWorkflowReady ? undefined : visibleChecks(analystWorkflowBlockers) || analystWorkflow.unavailableReason || 'Live analyst process data is syncing.',
        actions: [
            {
                id: 'open_analyst_case_workflow',
                label: 'Open case workflow',
                method: 'GET',
                href: analystWorkflow.href || '/ti/workbench',
            },
            ...(analystWorkflow.caseDetailRoute || analystWorkflow.caseId ? [{
                id: 'open_case_detail',
                label: 'Open case detail',
                method: 'GET' as const,
                href: analystWorkflow.caseDetailRoute || `/api/cases/${encodeURIComponent(analystWorkflow.caseId || '')}`,
            }] : []),
        ],
    })
}
