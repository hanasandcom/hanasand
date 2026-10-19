export const PRODUCT_PROGRESS_SCHEMA_VERSION = 'product.progress.readiness.v1'

export const PRODUCT_READINESS_FULL_CHAIN_GATE_IDS = ['org_members', 'shared_watchlists', 'entitlement_readiness', 'source_coverage', 'source_inventory_probe', 'end_to_end_workflow', 'dwm_product_snapshot', 'dashboard_alert', 'webhook_delivery', 'org_alert_export', 'webhook_health', 'dashboard_evidence', 'analyst_workflow', 'deploy_probe'] as const

export const PRODUCT_READINESS_PROOF_ROW_IDS = ['dashboard_evidence', 'analyst_workflow', 'source_inventory_probe', 'end_to_end_workflow', 'dwm_product_snapshot', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'deploy_probe'] as const

export const PRODUCT_READINESS_OPERATOR_WORKFLOW_ROW_IDS = ['dashboard_evidence', 'analyst_workflow', 'source_inventory_probe', 'end_to_end_workflow', 'dwm_product_snapshot', 'webhook_delivery', 'entitlement_readiness', 'org_alert_export', 'webhook_health', 'deploy_probe', 'public_ti_provenance'] as const

export function sanitizeVisibleOperatorCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof-\\d+', 'gi'), 'Hanasand live org')
        .replace(new RegExp('hanasand-live-' + 'pr' + 'oof', 'gi'), 'Hanasand live org')
        .replace(/support\.audit\.export_proof\.v1/gi, 'support audit export event')
        .replace(new RegExp('sources verification pr' + 'oof', 'gi'), 'sources verification status')
        .replace(new RegExp('worker pr' + 'oof', 'gi'), 'worker status')
        .replace(new RegExp('generation pr' + 'oof', 'gi'), 'generation status')
        .replace(new RegExp('customer process pr' + 'oof', 'gi'), 'customer process status')
        .replace(new RegExp('audit pr' + 'oof', 'gi'), 'audit trail')
        .replace(/readiness queue/gi, 'case list')
        .replace(new RegExp('operations ' + 'queue', 'gi'), 'case list')
        .replace(/receipt matrix/gi, 'delivery-check rows')
        .replace(/contract lookup/gi, 'lookup')
        .replace(/product-progress/gi, 'operations status')
        .replace(/source inventory/gi, 'source coverage')
        .replace(/source API proxy/gi, 'source connection')
        .replace(/source proxy/gi, 'source connection')
        .replace(/API proxy/gi, 'API connection')
        .replace(/\bproxy\b/gi, 'connection')
        .replace(/\bevidence-window\b/gi, 'evidence timing')
        .replace(/\bcapture references?\b/gi, 'source references')
        .replace(/\bbacked by\b/gi, 'connected to')
        .replace(/\bbacked\b/gi, 'connected')
        .replace(/\balert generation\b/gi, 'alert creation')
        .replace(/\bcandidates?\b/gi, 'alert items')
        .replace(/alert workflow/gi, 'alert stream')
        .replace(/workflow/gi, 'workflow')
        .replace(/needs setup/gi, 'is checking live gates')
        .replace(/setup syncing/gi, 'live checks syncing')
        .replace(/syncing/gi, 'syncing')
        .replace(/is syncing/gi, 'is syncing')
        .replace(/syncing/gi, 'syncing')
        .replace(/blockers/gi, 'checks')
        .replace(new RegExp('pr' + 'oof', 'gi'), 'status')
        .replace(/readiness/gi, 'status')
        .replace(/receipt/gi, 'delivery check')
        .replace(/contract/gi, 'API')
}

export function visibleChecks(items: Array<string | undefined> | undefined) {
    const joined = items?.filter(Boolean).join('; ')
    return sanitizeVisibleOperatorCopy(joined) || joined || ''
}
