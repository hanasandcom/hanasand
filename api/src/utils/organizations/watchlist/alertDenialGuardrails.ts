import type { OrganizationSharedWatchlistAlertQueueVisibility } from '../contracts/alertQueueVisibility.ts'

export function organizationSharedWatchlistAlertDenialGuardrails(
    denial: OrganizationSharedWatchlistAlertQueueVisibility['denialResponseContract']
): OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails'] {
    const requiredNoLeakFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredNoLeakFields'] = [
        'activeTerms',
        'watchlistScope.alertGeneratorKeys',
        'persistedAlertContract',
        'member.userId',
    ]
    const requiredResponseFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredResponseFields'] = [
        'error',
        'message',
        'organizationId',
        'visibilityDecision',
        'allowedRoles',
        'requestId',
    ]
    const blockerCodes: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['blockerCodes'] = []

    if (denial.statusCode !== 403 || denial.errorCode !== 'org_alert_visibility_denied') {
        blockerCodes.push('denial_status_missing')
    }
    if (!requiredResponseFields.every(field => denial.responseShape.includes(field))) {
        blockerCodes.push('denial_shape_missing')
    }
    if (!requiredNoLeakFields.every(field => denial.noLeakFields.includes(field))) {
        blockerCodes.push('denial_no_leak_missing')
    }
    if (denial.auditEventAction !== 'organization_watchlist_alert_visibility_denied') {
        blockerCodes.push('denial_audit_missing')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_alert_denial_guardrails.v1',
        ok: blockerCodes.length === 0,
        checkedFields: [
            'denialResponseContract.statusCode',
            'denialResponseContract.errorCode',
            'denialResponseContract.responseShape',
            'denialResponseContract.noLeakFields',
            'denialResponseContract.auditEventAction',
        ],
        requiredNoLeakFields,
        requiredResponseFields,
        requiredAuditEvent: 'organization_watchlist_alert_visibility_denied',
        blockerCodes,
    }
}
