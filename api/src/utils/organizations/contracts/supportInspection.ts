import type { OrganizationAlertVisibilityPolicy } from '../../organizationVisibility.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { WatchlistKind } from '../inputTypes.ts'

export type OrganizationSharedWatchlistSupportInspection = {
    schemaVersion: 'organization.shared_watchlist_support_inspection.v1'
    organizationId: string
    tenantId: string
    supportMode: 'redacted_summary_only'
    route: 'GET /api/admin/support/organizations/:id'
    supportActionContract: 'admin_support'
    redactionRequired: true
    canInspectRawTerms: false
    containsRawTerms: false
    summary: {
        activeTermCount: number
        pausedCount: number
        archivedCount: number
        termFamilies: WatchlistKind[]
        visibilityPolicy: OrganizationAlertVisibilityPolicy
        allowedViewerRoles: OrganizationRole[]
        cleanupRequired: boolean
    }
    safeFields: string[]
    redactedFields: string[]
    auditFields: string[]
    downstreamCorrelationFields: string[]
    blockerCodes: Array<'support_redaction_required' | 'support_only_access'>
    guardrails: {
        schemaVersion: 'organization.shared_watchlist_support_guardrails.v1'
        ok: boolean
        requiredSafeFields: Array<'activeTermCount' | 'termFamilies' | 'visibilityPolicy' | 'allowedViewerRoles'>
        requiredRedactedFields: Array<'activeTerms[].term' | 'member.userId' | 'sharedWatchlistIntegrationGuardrails.orgScope.alertGeneratorKeys'>
        requiredAuditFields: Array<'requestId' | 'actor.role'>
        rawTermAccessAllowed: false
        blockerCodes: Array<'support_safe_fields_missing' | 'support_redaction_missing' | 'support_audit_missing' | 'support_raw_access_enabled'>
    }
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}
