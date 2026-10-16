export interface TiActionabilityContract {
    schemaVersion?: 'ti.query.actionability.v1'
    alertDisposition?: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert?: boolean
    rationale?: string
    watchlistCandidates?: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        reason: string
        confidence?: number
    }>
    watchlistMatches?: Array<{
        tenantId?: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        kind: 'company' | 'domain' | 'vendor'
        value: string
        route?: string
        casePath?: string
    }>
    relatedAlerts?: Array<{
        id: string
        title: string
        status: string
        severity?: string
        caseIdCandidate?: string
        casePath?: string
        source?: string
        tenantId?: string
        organizationId?: string
        dedupeKey?: string
        recommendedRoute?: string
        captureIds?: string[]
        evidenceCount?: number
        webhookDestinationIds?: string[]
        deliveryReadinessContext?: {
            schemaVersion?: 'dwm.alert_delivery_persistence.v1'
            state?: 'ready' | 'blocked' | 'closed' | 'suppressed' | 'delivered'
            ready?: boolean
            blockerCodes?: string[]
            casePath?: string
            selectedCaptureIds?: string[]
            webhookDestinationIds?: string[]
            entitlement?: {
                status?: string
                blockedReasons?: string[]
            }
        }
    }>
    relatedCases?: Array<{
        id: string
        title: string
        status: string
        priority?: string
        path?: string
    }>
    relatedWebhookDestinations?: Array<{
        id: string
        name: string
        status: 'active' | 'paused' | 'disabled'
        path?: string
    }>
    sourceProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'
        parserStatus?: 'parsed' | 'partial' | 'queued' | 'failed' | 'missing_capture' | 'public_reference'
        reportDate?: string
        lastCollectedAt?: string
        confidence?: number
    }>
    enrichmentGaps?: Array<{
        id: string
        title: string
        severity: 'high' | 'medium' | 'low'
        detail: string
        dependency: string
        route?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator'
        requestedFields?: string[]
    }>
    handoffs?: {
        watchlist?: {
            method: 'POST'
            endpoint: string
            payloads: Array<{ kind: 'company' | 'domain' | 'vendor'; value: string; notes: string }>
            missing?: string[]
        }
        alertRebuild?: {
            method: 'POST'
            endpoint: string
            missing?: string[]
        }
        caseCreate?: {
            method: 'POST'
            endpoint: string
            payload?: { alertId: string; title?: string; priority?: string; note?: string }
            missing?: string[]
        }
        webhookDelivery?: {
            method: 'POST'
            endpoint: string
            payload?: Record<string, unknown>
            missing?: string[]
        }
    }
    entitlementReadiness?: {
        schemaVersion?: 'dwm.entitlement_readiness.v1'
        actions?: Record<string, {
            ownerLane?: string
            status?: 'allowed' | 'blocked' | 'permissive_no_policy' | 'needs_input'
            blockerCodes?: string[]
            route?: string
            dashboardText?: string
            helpdeskText?: string
            blockers?: Array<{
                schemaVersion?: 'dwm.entitlement_blocker.v1'
                ownerLane?: string
                actionId?: string
                blockerCode?: string
                route?: string
                supportText?: string
                dashboardText?: string
            }>
        }>
    }
}
