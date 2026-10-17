import type { buildReliability } from './reliability.ts'

export type UsageEconomicsRow = {
    bucket: string
    event_count: string | number
    token_units: string | number
    billable_units: string | number
    estimated_cost_nok: string | number
    verified_units: string | number
    platform_error_units: string | number
}

export type RecentRunRow = {
    id: string | number
    kind: AIUsageEventKind
    units: string | number
    billable_units: string | number
    estimated_cost_nok: string | number
    billing_mode: string
    outcome: string
    metadata: Record<string, unknown> | null
    created_at: string
}

export type DesignQualityRow = {
    completed: string | number
    failed: string | number
    total: string | number
    avg_score: string | number | null
}

export type DeploymentReadinessRow = {
    deployment_count: string | number
    recent_deployment_count: string | number
    running_deployments: string | number
    healthchecked_deployments: string | number
    deployments_with_sync_events: string | number
    deployments_with_stack: string | number
    deployments_with_access_policy: string | number
}

export type ReleaseReadinessRow = {
    release_count: string | number
    recent_release_count: string | number
    rollback_ready_releases: string | number
    current_releases: string | number
    superseded_releases: string | number
    failed_releases: string | number
}

export type LatestVerificationJobRow = {
    kind: string
    id: string
    status: string
    current_step: string
    error: string | null
    updated_at: string
    completed_at: string | null
    cancelled_at: string | null
}

export type LatestDeploymentRow = {
    id: string
    status: string
    vm_name: string
    service_name: string
    failure_reason: string | null
    updated_at: string
    completed_at: string | null
}

export type LatestReleaseRow = {
    id: string
    status: string
    deployment_id: string | null
    updated_at: string
}

export type ReadinessStatus = 'operational' | 'evidence_gap' | 'internal_action'

export type CommercialReadinessInput = {
    reliability: ReturnType<typeof buildReliability>
    deployment?: DeploymentReadinessRow
    release?: ReleaseReadinessRow
    designQuality?: DesignQualityRow
    latestVerificationJobs?: LatestVerificationJobRow[]
    latestDeployment?: LatestDeploymentRow
    latestRelease?: LatestReleaseRow
    eventCount: number
    verifiedUnits: number
    costNok: number
    productiveMinutes: number
}
