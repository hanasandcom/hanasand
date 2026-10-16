import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'
import { countReadinessBlockers } from './operatorModelUtils'
import { productReadinessProofMetadata, productReadinessWorkflow } from './productReadinessProofMetadata'
import { sanitizeVisibleOperatorCopy } from '@/utils/productProgress/readinessLabels'

export function withProductReadinessWorkflowMetadata(item: WorkbenchProductReadinessItem): WorkbenchProductReadinessItem {
    const cleanedItem = sanitizeProductReadinessItem(item)
    const blockerCount = cleanedItem.status === 'ready' ? 0 : countReadinessBlockers(cleanedItem.detail)
    const workflow = productReadinessWorkflow(cleanedItem)
    const proof = productReadinessProofMetadata(cleanedItem)
    const blocker = productReadinessBlockerMetadata(cleanedItem)
    return {
        ...cleanedItem,
        blockerCount,
        deepLinkTarget: cleanedItem.href,
        workflowBlocker: blocker.workflowBlocker,
        customerImpact: blocker.customerImpact,
        evidenceProvenance: sanitizeVisibleOperatorCopy(blocker.evidenceProvenance || cleanedItem.source),
        proofTimestamp: cleanedItem.proofTimestamp || cleanedItem.checkedAt,
        unavailableReason: cleanedItem.status === 'ready' ? undefined : sanitizeVisibleOperatorCopy(cleanedItem.unavailableReason || proof.unavailableReason || cleanedItem.source),
        staleAfterSeconds: cleanedItem.staleAfterSeconds ?? proof.staleAfterSeconds,
        expectedDashboardRowId: cleanedItem.expectedDashboardRowId || cleanedItem.id,
        integrationProbeHint: sanitizeVisibleOperatorCopy(cleanedItem.integrationProbeHint || proof.integrationProbeHint),
        backendProofContractVersion: cleanedItem.backendProofContractVersion || proof.backendProofContractVersion,
        ownerLane: workflow.ownerLane,
        operatorAction: workflow.operatorAction,
    }
}

function sanitizeProductReadinessItem(item: WorkbenchProductReadinessItem): WorkbenchProductReadinessItem {
    return {
        ...item,
        label: sanitizeVisibleOperatorCopy(item.label) || item.label,
        detail: sanitizeVisibleOperatorCopy(item.detail) || item.detail,
        source: sanitizeVisibleOperatorCopy(item.source) || item.source,
        workflowBlocker: sanitizeVisibleOperatorCopy(item.workflowBlocker),
        customerImpact: sanitizeVisibleOperatorCopy(item.customerImpact),
        evidenceProvenance: sanitizeVisibleOperatorCopy(item.evidenceProvenance),
        unavailableReason: sanitizeVisibleOperatorCopy(item.unavailableReason),
        integrationProbeHint: sanitizeVisibleOperatorCopy(item.integrationProbeHint),
    }
}

export function productReadinessBlockerMetadata(item: WorkbenchProductReadinessItem): {
    workflowBlocker: string
    customerImpact: string
    evidenceProvenance: string
} {
    const evidenceProvenance = [item.source, item.backendProofContractVersion].filter(Boolean).join(' -> ')
    switch (item.id) {
        case 'org_members':
        case 'entitlement_readiness':
            return {
                workflowBlocker: 'Organization setup',
                customerImpact: item.status === 'ready'
                    ? 'Analysts can work shared cases and alerts inside the selected organization scope.'
                    : 'Shared cases, watchlists, and delivery routing are held until organization access is proven.',
                evidenceProvenance,
            }
        case 'shared_watchlists':
        case 'org_alert_export':
            return {
                workflowBlocker: 'Shared watchlists',
                customerImpact: item.status === 'ready'
                    ? 'Customer terms can create alerts for the organization.'
                    : 'Customer terms begin producing organization alerts after active watchlists are saved.',
                evidenceProvenance,
            }
        case 'source_coverage':
        case 'source_inventory_probe':
            return {
                workflowBlocker: 'Source health',
                customerImpact: item.status === 'ready'
                    ? 'Source inventory and worker status can support alert generation.'
                    : 'Alert coverage is still building until source inventory and worker health are operator-reachable.',
                evidenceProvenance,
            }
        case 'end_to_end_workflow':
            return {
                workflowBlocker: 'Process status',
                customerImpact: item.status === 'ready'
                    ? 'The customer process can be traced from organization scope through alert, case, delivery, and support history.'
                    : 'Operators need the organization, watchlist, source, alert, case, webhook, and support details before trusting the process.',
                evidenceProvenance,
            }
        case 'dashboard_alert':
        case 'dashboard_evidence':
        case 'alert_generation':
        case 'dwm_product_snapshot':
            return {
                workflowBlocker: 'Alert generation',
                customerImpact: item.status === 'ready'
                    ? 'Analysts can select live alerts with evidence from the dashboard queue.'
                    : 'Inspect generation readiness before treating fallback rows as customer evidence.',
                evidenceProvenance,
            }
        case 'webhook_delivery':
        case 'webhook_health':
            return {
                workflowBlocker: 'Webhook delivery',
                customerImpact: item.status === 'ready'
                    ? 'Customer delivery can be inspected against destination and delivery history.'
                    : 'Customer notification delivery waits for a tested destination and matching delivery ledger.',
                evidenceProvenance,
            }
        case 'analyst_workflow':
            return {
                workflowBlocker: 'Case action replay',
                customerImpact: item.status === 'ready'
                    ? 'Analyst decisions can be reviewed against a backed case timeline.'
                    : 'Review, escalation, suppression, close, and replay unlock after a readable case is linked.',
                evidenceProvenance,
            }
        case 'helpdesk_audit':
            return {
                workflowBlocker: 'Support audit',
                customerImpact: item.status === 'ready'
                    ? 'Support actions have audit history for customer-facing recovery work.'
                    : 'Support recovery needs audit history before it is enterprise-ready.',
                evidenceProvenance,
            }
        case 'public_ti_provenance':
            return {
                workflowBlocker: 'Actor evidence bridge',
                customerImpact: item.status === 'ready'
                    ? 'Public TI artifacts can hand off into watchlist, alert, case, and source workflows.'
                    : 'Public TI artifacts need provenance and action readiness before they can drive customer operations.',
                evidenceProvenance,
            }
        case 'deploy_probe':
            return {
                workflowBlocker: 'Deploy status',
                customerImpact: item.status === 'ready'
                    ? 'The deployed surface has current probe evidence for dashboard alert and delivery paths.'
                    : 'Release is waiting for live probe evidence to confirm the dashboard workflow after deploy.',
                evidenceProvenance,
            }
        default:
            return {
                workflowBlocker: 'Workflow blocker',
                customerImpact: item.status === 'ready'
                    ? 'This workflow row is backed by live data.'
                    : 'This workflow needs live data before an operator can rely on it.',
                evidenceProvenance,
            }
    }
}
