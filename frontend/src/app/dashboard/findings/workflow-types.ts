export type WorkflowResult = { ok: boolean, message: string, actionHref?: string, actionLabel?: string }

export type WorkflowTelemetry = {
    activeSourceCount: number
    sourceCount: number
    captureCount: number
    watchlistMatchCount: number
    latestRunStatus?: string
    latestRunCaptureCount?: number
    alertCount: number
    deliveryCount: number
}

export type WorkflowRouteSummary = {
    label: string
    watchTerms: number
    sourceCount?: number
    captureCount?: number
    alertCount?: number
    alertId?: string
    caseId?: string
    caseHref?: string
    deliveryAttempts?: number
    deliveryState?: string
}

export type WorkflowProps = {
    headingLevel?: 1 | 2
    tenantId: string
    organizationId?: string
    initialTerms: string[]
    watchlistId?: string
    telemetry?: WorkflowTelemetry
    variant?: 'workflow' | 'watchlist-editor'
    onSaved?: () => void
}
