// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import DashboardUserOrganizations from '../src/components/users/dashboardUserOrganizations'

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
