import type { OrganizationRow } from './rowTypes.ts'
import { normalizeOrganizationStatus } from './normalization/organizationValues.ts'

export function organizationSettingsFromRow(row: Pick<OrganizationRow, 'status' | 'default_webhook_policy' | 'alert_visibility_policy' | 'retention_days' | 'audit_safe_metadata'>) {
    return {
        defaultWebhookPolicy: row.default_webhook_policy ?? 'active_destinations',
        alertVisibilityPolicy: row.alert_visibility_policy ?? 'members',
        lifecycleStatus: normalizeOrganizationStatus(row.status),
        retentionDays: Number(row.retention_days ?? 365),
        auditSafeMetadata: row.audit_safe_metadata ?? {},
    }
}
