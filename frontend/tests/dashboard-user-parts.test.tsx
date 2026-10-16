// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import DashboardUserOrganizations from '../src/components/users/dashboardUserOrganizations'
import ImpersonationReasonPrompt from '../src/components/users/impersonationReasonPrompt'

test('user organization popover only links memberships the viewer may access', () => {
    const html = renderToStaticMarkup(<DashboardUserOrganizations
        userName='Ada Example'
        accessibleOrganizationIds={['org-active']}
        organizations={[
            { id: 'org-active', name: 'Available', slug: 'available', status: 'active' },
            { id: 'org-inactive', name: 'Archived', slug: 'archived', status: 'active' },
            { id: 'org-suspended', name: 'Suspended', slug: 'suspended', status: 'suspended' },
        ]}
    />)

    expect(html).toContain('Show 3 organizations for Ada Example')
    expect(html).toContain('href="/organizations?organizationId=org-active"')
    expect(html).not.toContain('href="/organizations?organizationId=org-inactive"')
    expect(html).not.toContain('href="/organizations?organizationId=org-suspended"')
})

test('impersonation prompt retains audit guidance, normalized length and pending controls', () => {
    const html = renderToStaticMarkup(<ImpersonationReasonPrompt
        userId='user-1'
        userName='Ada Example'
        reason='  support   case  '
        reasonError='Explain the support case.'
        pending
        onReasonChange={() => {}}
        onCancel={() => {}}
        onSubmit={() => {}}
    />)

    expect(html).toContain('Impersonation reason for user-1')
    expect(html).toContain('Reason for impersonating Ada Example')
    expect(html).toContain('support case')
    expect(html).toContain('Required for audit. Starts a 30 minute profile and organization session.')
    expect(html).toContain('12/10')
    expect(html).toContain('Explain the support case.')
    expect(html).toContain('disabled=""')
})
