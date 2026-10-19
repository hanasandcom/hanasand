import type { WorkbenchProductReadinessItem } from './ti/workbench/workbenchClient'

export function productReadinessWorkflow(item: WorkbenchProductReadinessItem): { ownerLane: string, operatorAction: string } {
    switch (item.id) {
        case 'org_members':
            return { ownerLane: 'Org admin', operatorAction: item.status === 'ready' ? 'Review members' : 'Open organization setup' }
        case 'shared_watchlists':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Review watchlists' : 'Create shared watchlist' }
        case 'entitlement_readiness':
            return { ownerLane: 'Customer success', operatorAction: item.status === 'ready' ? 'Review entitlement' : 'Resolve DWM entitlement' }
        case 'source_coverage':
        case 'source_inventory_probe':
            return { ownerLane: 'Collection', operatorAction: item.status === 'ready' ? 'Review source health' : 'Open collection' }
        case 'end_to_end_workflow':
            return { ownerLane: 'Operator', operatorAction: item.status === 'ready' ? 'Review path' : 'Open review checks' }
        case 'dashboard_alert':
        case 'dashboard_evidence':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Open alert evidence' : 'Open dashboard evidence' }
        case 'analyst_workflow':
            return { ownerLane: 'SOC analyst', operatorAction: item.status === 'ready' ? 'Review case workflow' : 'Open analyst cases' }
        case 'dwm_product_snapshot':
            return { ownerLane: 'DWM owner', operatorAction: item.status === 'ready' ? 'Inspect DWM monitor' : 'Open DWM product status' }
        case 'webhook_delivery':
        case 'webhook_health':
            return { ownerLane: 'Delivery ops', operatorAction: item.status === 'ready' ? 'Review delivery history' : 'Open delivery setup' }
        case 'org_alert_export':
            return { ownerLane: 'Org admin', operatorAction: item.status === 'ready' ? 'Review alert terms' : 'Open watchlist export' }
        case 'deploy_probe':
            return { ownerLane: 'Release owner', operatorAction: item.status === 'ready' ? 'Review live probe' : 'Open deploy status' }
        case 'public_ti_provenance':
            return { ownerLane: 'TI analyst', operatorAction: item.status === 'ready' ? 'Review provenance' : 'Open public TI handoff' }
        default:
            return { ownerLane: 'Operator', operatorAction: item.href ? 'Open workflow' : 'Review blocker' }
    }
}

export function productReadinessProofMetadata(item: WorkbenchProductReadinessItem): {
    backendProofContractVersion: string
    integrationProbeHint: string
    staleAfterSeconds: number
    unavailableReason: string
} {
    switch (item.id) {
        case 'org_members':
            return {
                backendProofContractVersion: 'organization.lifecycle.readiness.v1',
                integrationProbeHint: 'GET /api/organizations and /api/organizations/:id/members must return a selected organization and active member.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_org_membership_readiness',
            }
        case 'shared_watchlists':
            return {
                backendProofContractVersion: 'organization.watchlist_lifecycle.readiness.v1',
                integrationProbeHint: 'GET/POST /api/findings/watchlists must return at least one active shared watchlist with alert terms.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_shared_watchlist_readiness',
            }
        case 'entitlement_readiness':
            return {
                backendProofContractVersion: 'dwm.entitlement.readiness.v1',
                integrationProbeHint: 'GET /api/findings/entitlements/readiness must return policy, checked role, allowed action, and blockers.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dwm_entitlement_readiness_api',
            }
        case 'source_coverage':
            return {
                backendProofContractVersion: 'dwm.operations.source_coverage.v1',
                integrationProbeHint: 'GET /api/findings/operations must return active monitored sources and latest run state.',
                staleAfterSeconds: 1800,
                unavailableReason: 'missing_dwm_operations_source_coverage',
            }
        case 'source_inventory_probe':
            return {
                backendProofContractVersion: 'dwm.source_inventory.v1',
                integrationProbeHint: 'GET /api/ti/scraper/control?q=<query> must expose source inventory, source packs, and worker status.',
                staleAfterSeconds: 7200,
                unavailableReason: 'missing_source_proxy_worker_readiness',
            }
        case 'end_to_end_workflow':
            return {
                backendProofContractVersion: 'hanasand.product_readiness.end_to_end_workflow_packet.v1',
                integrationProbeHint: 'GET /api/ti/scraper/control must expose typed workflow steps.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_end_to_end_workflow_packet',
            }
        case 'dashboard_alert':
            return {
                backendProofContractVersion: 'dwm.alert.matching.readiness.v1',
                integrationProbeHint: 'GET /api/findings/alerts must return a live alert visible in the operator dashboard queue.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dashboard_alert',
            }
        case 'dwm_product_snapshot':
            return {
                backendProofContractVersion: 'dwm.product.v1',
                integrationProbeHint: 'GET /api/findings/product must return watchlist, source coverage, and alert status from the TI service.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_dwm_product_snapshot',
            }
        case 'webhook_delivery':
            return {
                backendProofContractVersion: 'dwm.webhook.delivery_ledger.v1',
                integrationProbeHint: 'GET /api/findings/webhooks/deliveries must return a delivery row for a dashboard-visible alert.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_matching_delivery',
            }
        case 'org_alert_export':
            return {
                backendProofContractVersion: 'organization.worker3_ui_readiness_proof.v1',
                integrationProbeHint: 'GET /api/organizations/:id/alert-readiness must return organization alertability and active watchlist term counts.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_org_alert_export_readiness_api',
            }
        case 'webhook_health':
            return {
                backendProofContractVersion: 'dwm.webhook_health.readiness.v1',
                integrationProbeHint: 'GET /api/findings/webhooks must return active destination count and lifecycle health, not only delivery rows.',
                staleAfterSeconds: 900,
                unavailableReason: 'missing_webhook_lifecycle_health_api',
            }
        case 'dashboard_evidence':
            return {
                backendProofContractVersion: 'dashboard.alert_evidence.readiness.v1',
                integrationProbeHint: 'Dashboard evidence is ready when a live alert is visible, delivery evidence matches it, sources is ready, and deploy probe is fresh.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_dashboard_alert_evidence',
            }
        case 'analyst_workflow':
            return {
                backendProofContractVersion: 'analyst.workflow.readiness.v1',
                integrationProbeHint: 'GET /api/cases must return a case linked to the dashboard-visible alert before analyst process is active.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_analyst_case_readiness',
            }
        case 'public_ti_provenance':
            return {
                backendProofContractVersion: 'ti.public_provenance.readiness.v1',
                integrationProbeHint: 'GET /api/public-ti/provenance/readiness must return source, evidence, and freshness status.',
                staleAfterSeconds: 3600,
                unavailableReason: 'missing_public_ti_provenance_readiness_api',
            }
        case 'deploy_probe':
            return {
                backendProofContractVersion: 'product.deploy_probe.readiness.v1',
                integrationProbeHint: 'Post-deploy probe must record deployed commit, frontend/API/scraper health, dashboard alert id, delivery id, and probe time.',
                staleAfterSeconds: 600,
                unavailableReason: 'missing_live_deploy_probe',
            }
        default:
            return {
                backendProofContractVersion: 'unknown.readiness.v1',
                integrationProbeHint: item.source,
                staleAfterSeconds: 900,
                unavailableReason: 'missing_workflow_data',
            }
    }
}
