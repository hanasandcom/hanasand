import { type OrganizationAlertVisibilityPolicy, type OrganizationRole } from '#utils/organizations.ts'
import { clean } from '#utils/dwm/webhooks.ts'

export type IdParams = {
    id: string
}

export type OrgQuery = {
    orgId?: string
    org_id?: string
    includeAudit?: string
    destinationId?: string
    destination_id?: string
    alertId?: string
    alert_id?: string
    casePath?: string
    case_path?: string
    dedupeKey?: string
    dedupe_key?: string
    requestId?: string
    request_id?: string
    deliveryId?: string
    delivery_id?: string
    idempotencyKey?: string
    idempotency_key?: string
    action?: string
    status?: string
    timeFrom?: string
    time_from?: string
    timeTo?: string
    time_to?: string
    retryState?: string
    retry_state?: string
    actorId?: string
    actor_id?: string
    reportCaseId?: string
    report_case_id?: string
    reportExportChecksum?: string
    report_export_checksum?: string
}

export type Membership = {
    role: OrganizationRole
    status?: 'active' | 'removed'
    user_active?: boolean
    alert_visibility_policy?: OrganizationAlertVisibilityPolicy
    organization_status?: string
    privacy_deletion_run_id?: string | null
}

export function orgIdFromQuery(query: OrgQuery | undefined) {
    return firstQueryValue(query, 'orgId', 'org_id')
}

export function firstQueryValue(query: OrgQuery | undefined, ...keys: Array<keyof OrgQuery>) {
    for (const key of keys) {
        const value = clean(query?.[key])
        if (value) return value
    }
    return ''
}
