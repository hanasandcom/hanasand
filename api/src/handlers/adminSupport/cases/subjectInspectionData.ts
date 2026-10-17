import run from '#db'
import { organizationMembershipAvailability } from '#utils/organizationMemberships.ts'
import { organizationMembershipIdentityColumns } from '#utils/organizations/membershipIdentityColumns.ts'
import { loadInspectionApprovals } from '../inspectionEventLoaders.ts'

export async function loadSupportOrganizationInspectionData(organizationId: string) {
    const [members, invites, watchlists, webhookDestinations, audit, availability] = await Promise.all([
        run(`
            SELECT
                ${organizationMembershipIdentityColumns('users')},
                users.active,
                users.deactivated_at,
                users.deletion_scheduled_at
            FROM organization_members om
            JOIN users ON users.id = om.user_id
            WHERE om.organization_id = $1
            ORDER BY
                CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                users.name ASC
        `, [organizationId]),
        run(`
            SELECT *
            FROM organization_invites
            WHERE organization_id = $1
            ORDER BY status ASC, created_at DESC
        `, [organizationId]),
        run(`
            SELECT *
            FROM organization_watchlist_items
            WHERE organization_id = $1
              AND archived_at IS NULL
            ORDER BY kind ASC, value ASC
        `, [organizationId]),
        run(`
            SELECT
                id,
                org_id,
                owner_id,
                name,
                kind,
                endpoint_hint,
                endpoint_hash <> '' AS endpoint_fingerprint_present,
                status,
                events,
                created_by,
                last_tested_at,
                last_test_status,
                last_test_error IS NOT NULL AS last_test_error_present,
                last_test_http_status,
                last_delivery_at,
                created_at,
                updated_at
            FROM dwm_webhook_destinations
            WHERE org_id = $1
              AND status <> 'archived'
            ORDER BY status ASC, updated_at DESC
        `, [organizationId]),
        run(`
            SELECT id, event_type, severity, source, service, actor_id, object_type, object_id, subject_id, request_id, outcome, reason, context, created_at
            FROM system_events
            WHERE organization_id = $1
            ORDER BY created_at DESC
            LIMIT 25
        `, [organizationId]),
        organizationMembershipAvailability([organizationId]),
    ])
    return { members, invites, watchlists, webhookDestinations, audit, availability }
}

export async function loadSupportUserInspectionData(input: { userId: string; email: string; requestId: string }) {
    const [memberships, invites, audit, approvals] = await Promise.all([
        run(`
            SELECT
                om.user_id,
                om.organization_id,
                organizations.name AS organization_name,
                organizations.slug AS organization_slug,
                om.role,
                om.status,
                om.invited_by,
                om.joined_at,
                om.created_at
            FROM organization_members om
            JOIN organizations ON organizations.id = om.organization_id
            WHERE om.user_id = $1
            ORDER BY organizations.name ASC
        `, [input.userId]),
        run(`
            SELECT organization_invites.*, organizations.name AS organization_name, organizations.slug AS organization_slug
            FROM organization_invites
            JOIN organizations ON organizations.id = organization_invites.organization_id
            WHERE lower(organization_invites.email) = lower($1)
              AND organization_invites.status = 'pending'
            ORDER BY organization_invites.created_at DESC
        `, [input.email]),
        run(`
            SELECT id, event_type, severity, source, service, actor_id, object_type, object_id, organization_id, subject_id, request_id, outcome, reason, context, created_at
            FROM system_events
            WHERE object_id = $1
               OR actor_id = $1
               OR subject_id = $1
            ORDER BY created_at DESC
            LIMIT 25
        `, [input.userId]),
        loadInspectionApprovals({ org: '', user: input.userId, email: '', request: input.requestId, outcome: '', limit: 25 }),
    ])
    return { memberships, invites, audit, approvals }
}
