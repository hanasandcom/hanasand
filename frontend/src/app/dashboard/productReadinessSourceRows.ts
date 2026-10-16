import type { ProductReadinessContext } from './productReadinessContext'
import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'
import { publicTiProvenanceDetail, helpdeskAuditDetail, deployProbeDetail } from '@/utils/productProgress/readinessDetails'

export function buildSourceProductReadinessRows(context: ProductReadinessContext): WorkbenchProductReadinessItem[] {
    const { publicTiProvenance, helpdeskAudit, deployProbe, sourceGrowth } = context
    return [
        {
            id: 'end_to_end_workflow',
            label: 'customer process',
            status: sourceGrowth?.endToEndWorkflow?.status || 'blocked',
            detail: sourceGrowth?.endToEndWorkflow?.detail || 'End-to-end customer process state is loading through the sources.',
            source: sourceGrowth?.source || 'GET /api/ti/scraper/control process status',
            href: '/ti/sources',
            checkedAt: sourceGrowth?.endToEndWorkflow?.lastVerifiedAt || sourceGrowth?.checkedAt || sourceGrowth?.latestInventoryAt,
            staleAfterSeconds: sourceGrowth?.staleAfterSeconds || 900,
            proofTimestamp: sourceGrowth?.endToEndWorkflow?.lastVerifiedAt || sourceGrowth?.proofTimestamp,
            unavailableReason: sourceGrowth?.endToEndWorkflow?.status === 'ready' ? undefined : 'missing_end_to_end_workflow_packet',
            expectedDashboardRowId: 'end_to_end_workflow',
            integrationProbeHint: 'GET /api/ti/scraper/control must expose org, watchlist, source, alert, case, webhook, delivery, and support steps.',
            backendProofContractVersion: sourceGrowth?.endToEndWorkflow?.schemaVersion || 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
            endToEndWorkflowStepCount: sourceGrowth?.endToEndWorkflow?.stepCount,
            endToEndWorkflowReadyStepCount: sourceGrowth?.endToEndWorkflow?.readyStepCount,
            endToEndWorkflowBlockedStepCount: sourceGrowth?.endToEndWorkflow?.blockedStepCount,
            endToEndWorkflowMissingFieldCount: sourceGrowth?.endToEndWorkflow?.missingFieldCount,
        },
        {
            id: 'public_ti_provenance',
            label: 'Public TI provenance',
            status: publicTiProvenance?.status || 'needs_action',
            detail: publicTiProvenance
                ? publicTiProvenance.detail || publicTiProvenanceDetail(publicTiProvenance)
                : 'Actor evidence provenance is checked from the selected record.',
            source: publicTiProvenance?.source || 'Actor evidence bridge data',
            href: '/ti',
            checkedAt: publicTiProvenance?.checkedAt || publicTiProvenance?.latestArtifactAt,
            staleAfterSeconds: publicTiProvenance?.staleAfterSeconds,
            proofTimestamp: publicTiProvenance?.proofTimestamp,
            unavailableReason: publicTiProvenance?.unavailableReason,
            expectedDashboardRowId: publicTiProvenance?.expectedDashboardRowId,
            integrationProbeHint: publicTiProvenance?.integrationProbeHint,
            backendProofContractVersion: publicTiProvenance?.backendProofContractVersion || publicTiProvenance?.schemaVersion,
        },
        {
            id: 'helpdesk_audit',
            label: 'Helpdesk and audit',
            status: helpdeskAudit?.status || 'unavailable',
            detail: helpdeskAudit
                ? helpdeskAudit.detail || helpdeskAuditDetail(helpdeskAudit)
                : 'Support and audit state is loading to the dashboard.',
            source: helpdeskAudit?.source || 'dashboard support',
            href: '/helpdesk',
            checkedAt: helpdeskAudit?.checkedAt || helpdeskAudit?.latestAuditEventAt,
            staleAfterSeconds: helpdeskAudit?.staleAfterSeconds,
            proofTimestamp: helpdeskAudit?.proofTimestamp,
            unavailableReason: helpdeskAudit?.unavailableReason,
            expectedDashboardRowId: helpdeskAudit?.expectedDashboardRowId,
            integrationProbeHint: helpdeskAudit?.integrationProbeHint,
            backendProofContractVersion: helpdeskAudit?.backendProofContractVersion || helpdeskAudit?.schemaVersion,
        },
        {
            id: 'deploy_probe',
            label: 'Deploy and live probes',
            status: deployProbe?.status || 'unavailable',
            detail: deployProbe
                ? deployProbe.detail || deployProbeDetail(deployProbe)
                : 'Deploy probe recency state is loading to this dashboard.',
            source: deployProbe?.source || 'deploy status',
            href: '/status',
            checkedAt: deployProbe?.checkedAt || deployProbe?.latestProbeAt,
            staleAfterSeconds: deployProbe?.staleAfterSeconds,
            proofTimestamp: deployProbe?.proofTimestamp,
            unavailableReason: deployProbe?.unavailableReason,
            expectedDashboardRowId: deployProbe?.expectedDashboardRowId,
            integrationProbeHint: deployProbe?.integrationProbeHint,
            backendProofContractVersion: deployProbe?.backendProofContractVersion || deployProbe?.schemaVersion,
        },
    ]
}
