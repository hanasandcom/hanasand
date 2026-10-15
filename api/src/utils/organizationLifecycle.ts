import type { OrganizationRow } from '#utils/organizations.ts'
import run from '#db'

/** True while privacy deletion has placed the organization in a write-locked state. */
export function organizationPrivacyDeletionInProgress(
    organization: Pick<OrganizationRow, 'audit_safe_metadata'>,
) {
    return Boolean(organization.audit_safe_metadata?.privacyDeletionRunId)
}

/** Checks whether the database metadata contains the deletion marker key. */
export async function hasOrganizationPrivacyDeletionMarker(organizationId: string, query: typeof run = run) {
    const result = await query(
        'SELECT audit_safe_metadata ? \'privacyDeletionRunId\' locked FROM organizations WHERE id = $1',
        [organizationId],
    )
    return result.rows[0]?.locked === true
}
