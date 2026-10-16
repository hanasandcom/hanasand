import type { WorkbenchCase } from './ti/workbench/workbenchClient'
import type { ReadinessCaseContext } from './readinessCaseContext'
import { readinessCase } from './readinessCaseFactory'

export function buildSetupOrganizationCase(context: ReadinessCaseContext): WorkbenchCase {
    const { input, now, organization, activeOrgMembers, pendingOrgInvites, orgWebhooks, path } = context
    return readinessCase({
        id: 'setup_organization',
        kind: 'org_readiness',
        queue: 'Org access',
        title: organization ? `${organization.name} organization active` : 'Create organization context',
        severity: organization ? 'medium' : 'high',
        status: organization ? 'org_active' : input.backendConfigured ? 'missing_organization' : 'backend_unconfigured',
        priority: organization ? 285 : 390,
        confidence: input.backendConfigured ? 94 : 64,
        subtitle: organization
            ? `${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, ${orgWebhooks.length} active destination${orgWebhooks.length === 1 ? '' : 's'}.`
            : input.backendConfigured ? 'Organization service is reachable; workspace organization context is syncing.' : 'Organization membership is syncing to collection.',
        recommendedAction: organization ? 'Continue through shared watchlist, alert rebuild, case opening, and webhook delivery under this organization.' : 'Create or join an organization before selling shared ownership, shared watchlists, or team routing.',
        evidence: [{
            id: 'ev_organization_api',
            sourceName: 'Organizations',
            sourceFamily: 'organization roster',
            captureMode: 'operator view',
            redactionState: 'customer safe',
            contentHash: organization?.id || '/api/organizations',
            excerpt: organization ? `${organization.name} (${organization.slug}) is ${organization.status}; ${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, ${orgWebhooks.length} active webhook destination${orgWebhooks.length === 1 ? '' : 's'}.` : 'Organization record is syncing for this workspace.',
            observedAt: organization?.updatedAt || now,
            provenance: 'Organization roster',
            confidence: input.backendConfigured ? 94 : 64,
        }],
        timeline: [{ id: 'organization_setup_audit', at: organization?.updatedAt || now, title: organization ? 'Organization lane active' : 'Organization lane checking', body: organization ? `Organization lane has ${activeOrgMembers.length} active member${activeOrgMembers.length === 1 ? '' : 's'}, ${pendingOrgInvites.length} pending invite${pendingOrgInvites.length === 1 ? '' : 's'}, and ${orgWebhooks.length} active webhook destination${orgWebhooks.length === 1 ? '' : 's'}.` : 'Create or join an organization before claiming shared team ownership.' }],
        nextTasks: organization ? [`Owner: operator. Organization: ${organization.id}. Inspect members and pending invites.`, 'Check alert visibility before rebuilding alerts.', 'Create or test org webhook destination before customer routing.'] : ['Owner: platform. Create or select an organization with name and owner email.', 'Invite analysts through the organization members.', 'Create an org webhook destination before customer routing.'],
        relatedLinks: organization ? [{ href: '/api/organizations', label: 'Organizations' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/members`, label: 'Members' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`, label: 'Alert visibility' }, { href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`, label: 'Webhooks' }] : [{ href: '/api/organizations', label: 'Create organization' }],
        workflowPath: path,
        actions: organization ? [{
            id: 'inspect_org_members',
            label: 'Inspect members',
            method: 'GET',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/members`,
        }, {
            id: 'inspect_org_alert_readiness',
            label: 'Inspect visibility',
            method: 'GET',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/alert-readiness`,
        }, {
            id: 'inspect_org_webhooks',
            label: 'Inspect webhooks',
            method: 'GET',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`,
        }, {
            id: 'invite_org_member',
            label: 'Invite teammate',
            method: 'GET',
            href: `/api/organizations/${encodeURIComponent(organization.id)}/invites`,
        }] : [{ id: 'create_organization', label: 'Create organization', method: 'GET', href: '/api/organizations' }],
    })
}
