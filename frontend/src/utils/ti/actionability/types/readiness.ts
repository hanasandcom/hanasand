import type { TiHandoffExportPayload } from './actionability'

export type WorkflowHandoffContract = {
    schemaVersion: 'ti.public_actor.workflow_handoff.v1'
    kind: 'create_alert' | 'case' | 'webhook_delivery'
    method: 'POST'
    endpoint: string
    ready: boolean
    blocked: boolean
    missing: string[]
    payload: Record<string, unknown>
    backedRoute?: string
    provenance: TiHandoffExportPayload['provenance']
}

export type ConsumerReadinessContract = {
    schemaVersion: 'ti.public_actor.consumer_readiness.v1'
    consumerSchemaVersion: 'hanasand.analyst_handoff.consumer.v1'
    orgTermsExportSchemaVersion: 'organization.watchlist_alert_terms_export.v1'
    webhookAuditSchemaVersion: 'dwm.webhook.audit_event.v1'
    ready: boolean
    generatedAt: string
    stages: ConsumerReadinessStage[]
    blockers: ConsumerReadinessBlocker[]
    bundlePreview: {
        schemaVersion: 'hanasand.analyst_handoff.consumer.v1'
        generatedAt: string
        stages: Record<string, { request?: ConsumerReadinessRequest; missing: string[] }>
    }
}

export type ConsumerReadinessStage = {
    id: 'publicTi' | 'orgWatchlist' | 'caseHandoff' | 'webhookTrigger' | 'enrichment'
    label: string
    state: 'ready' | 'blocked' | 'review'
    detail: string
    route?: string
    request?: ConsumerReadinessRequest
    payload: TiHandoffExportPayload
    missing: string[]
}

export type ConsumerReadinessRequest = {
    method: 'POST'
    path: '/v1/dwm/watchlists' | '/v1/dwm/alerts/rebuild' | '/v1/cases' | '/v1/dwm/webhooks/deliver' | '/ti/enrichment'
    body: Record<string, unknown>
}

export type ConsumerReadinessBlocker = {
    code: 'missing_org' | 'missing_provenance' | 'stale_evidence' | 'absent_alert_id' | 'missing_watchlist_term' | 'missing_watchlist_id' | 'missing_watchlist_item' | 'webhook_trigger_contract_mismatch' | 'webhook_audit_contract_mismatch' | 'missing_stage'
    stage: ConsumerReadinessStage['id']
    field: string
    detail: string
    recoverable: boolean
}
