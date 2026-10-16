import run from '#db'
import {
    organizationVisibilityDecision,
    roleCanEditOrganization,
    type OrganizationVisibilityDecisionInput,
} from '#utils/organizations.ts'
import {
    buildDwmWebhookDestinationCrudContract,
    clean,
    listDwmWebhookAuditEvents,
    listDwmWebhookDeliveries,
    listDwmWebhookDestinations,
    type DwmWebhookDestinationInput,
} from '#utils/dwm/webhooks.ts'
import type { Membership } from './webhookRouteTypes.ts'

export function destinationLifecycleAccess(orgId: string, userId: string, membership: Membership | null) {
    const role = orgId && orgId !== userId ? membership?.role || null : 'owner'
    return {
        viewerRole: role,
        canManage: roleCanEditOrganization(role || undefined),
    }
}

export function webhookOrganizationVisibilityContext(
    orgId: string,
    userId: string,
    membership: Membership | null,
    options: { membershipIsActive?: boolean } = {},
): OrganizationVisibilityDecisionInput | null {
    if (!orgId || orgId === userId) return null
    const membershipIsActive = options.membershipIsActive === true
    return {
        role: membership?.role,
        status: membershipIsActive ? 'active' : membership?.status,
        userActive: membershipIsActive ? true : membership?.user_active,
        alertVisibilityPolicy: membership?.alert_visibility_policy,
    }
}

function destinationCrudActionForUpdate(input: DwmWebhookDestinationInput, destination: { status?: string } | null) {
    const nextStatus = clean(input.status)
    if (destination && destination.status !== 'active' && nextStatus === 'active') return 'enable' as const
    return 'update' as const
}

export async function loadDestinationCrudPreflight(
    ownerId: string,
    orgId: string,
    destinationId: string,
    requestedAction: 'update' | 'delete' | 'test',
    input: DwmWebhookDestinationInput,
) {
    const destinations = await listDwmWebhookDestinations(ownerId, orgId)
    const destination = destinations.find(item => item.id === destinationId) || null
    const deliveries = await listDwmWebhookDeliveries(ownerId, orgId)
    const auditEvents = await listDwmWebhookAuditEvents(ownerId, orgId)
    const context = { destinations, destination, deliveries, auditEvents }
    const action = requestedAction === 'update'
        ? destinationCrudActionForUpdate(input, destination)
        : requestedAction
    const destinationCrud = buildDwmWebhookDestinationCrudContract({
        action,
        ownerId,
        input,
        ...context,
        viewerRole: 'admin',
        canManage: true,
    })
    return { ...context, action, destinationCrud }
}

export async function loadOrganizationMembership(orgId: string, userId: string): Promise<Membership | null> {
    const result = await run(`
        SELECT member.role, organization.status AS organization_status,
               organization.audit_safe_metadata->>'privacyDeletionRunId' AS privacy_deletion_run_id
        FROM organization_members member
        JOIN organizations organization ON organization.id = member.organization_id
        WHERE member.organization_id = $1
          AND member.user_id = $2
          AND member.status = 'active'
        LIMIT 1
    `, [orgId, userId])
    return result.rows[0] as Membership | undefined || null
}

export async function loadOrganizationName(orgId: string): Promise<string | undefined> {
    const result = await run('SELECT name FROM organizations WHERE id = $1 LIMIT 1', [orgId])
    return clean((result.rows[0] as { name?: string } | undefined)?.name) || undefined
}

export async function loadOrganizationVisibilityMembership(orgId: string, userId: string): Promise<Membership | null> {
    const result = await run(`
        SELECT
            om.role,
            om.status,
            u.active AS user_active,
            o.alert_visibility_policy
        FROM organizations o
        LEFT JOIN organization_members om
          ON om.organization_id = o.id
         AND om.user_id = $2
        LEFT JOIN users u
          ON u.id = $2
        WHERE o.id = $1
        LIMIT 1
    `, [orgId, userId])
    return result.rows[0] as Membership | undefined || null
}

export async function configurationPermissionError(orgId: string, userId: string) {
    if (!orgId || orgId === userId) return null
    const membership = await loadOrganizationMembership(orgId, userId)
    if (!membership) return { status: 404, message: 'Organization not found.' }
    if (membership.privacy_deletion_run_id || membership.organization_status !== 'active') {
        return {
            status: 409,
            message: membership.privacy_deletion_run_id
                ? 'Organization deletion is in progress; writes are blocked.'
                : 'Organization lifecycle blocks webhook changes.',
        }
    }
    if (!roleCanEditOrganization(membership.role)) {
        return { status: 403, message: 'Only organization owners, admins, and editors can configure webhook destinations.' }
    }
    return null
}
