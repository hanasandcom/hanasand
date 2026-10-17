// @ts-expect-error Bun provides this module when running tests.
import { expect, mock, test } from 'bun:test'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let currentUserActive = true
const fetchCalls: Array<{ id?: string, token?: string, cache?: RequestCache }> = []
mock.module('next/headers', () => ({
    cookies: async () => ({ get: (name: string) => ({ value: ({ name: 'Admin', id: 'admin', access_token: 'token' } as Record<string, string>)[name] }) }),
}))
mock.module('next/navigation', () => ({
    redirect: (path: string) => { throw new Error(`Unexpected redirect: ${path}`) },
    useRouter: () => ({ push() {}, refresh() {} }),
}))
mock.module('next/link', () => ({
    default: ({ href, children, className }: { href: string, children: ReactNode, className?: string }) =>
        createElement('a', { href, className }, children),
}))
mock.module('@/utils/users/fetchUsers', () => ({
    default: async (input: { id?: string, token?: string, cache?: RequestCache }) => {
        fetchCalls.push(input)
        return [
            {
                id: 'admin', name: 'Admin', avatar: '', active: currentUserActive,
                organization_memberships: [
                    { id: 'org-allowed', name: 'Allowed', slug: 'allowed', status: 'active' },
                    { id: 'org-inactive', name: 'Inactive', slug: 'inactive', status: 'inactive' },
                    { id: 'org-pending', name: 'Pending', slug: 'pending', status: 'pending' },
                ],
            },
            {
                id: 'target', name: 'Target', avatar: '', active: true,
                organization_memberships: [
                    { id: 'org-allowed', name: 'Allowed', slug: 'allowed', status: 'active' },
                    { id: 'org-inactive', name: 'Inactive', slug: 'inactive', status: 'active' },
                    { id: 'org-pending', name: 'Pending', slug: 'pending', status: 'active' },
                ],
            },
        ]
    },
}))

const { default: Page } = await import('../src/app/dashboard/management/users/page')
const { default: Users } = await import('../src/components/users/users')
const { default: UsersList } = await import('../src/components/users/usersList')

async function organizationLinks() {
    fetchCalls.length = 0
    const page = await Page()
    const usersElement = findElement(page, Users)
    if (!usersElement) throw new Error('Management users page did not render Users')
    const panel = await Users(usersElement.props as Parameters<typeof Users>[0])
    const listElement = findElement(panel, UsersList)
    if (!listElement) throw new Error('Users did not render UsersList')
    const html = renderToStaticMarkup(panel)
    return {
        accessibleOrganizationIds: (listElement.props as Parameters<typeof UsersList>[0]).accessibleOrganizationIds,
        links: [...html.matchAll(/<a href="([^"]*\/organizations\?organizationId=[^"]*)"/g)].map((match) => match[1]),
        fetchCalls,
    }
}

function findElement(node: ReactNode, component: ReactElement['type']): ReactElement | null {
    if (!isValidElement(node)) return null
    if (node.type === component) return node
    const children = (node.props as { children?: ReactNode }).children
    for (const child of Array.isArray(children) ? children : [children]) {
        const found = findElement(child, component)
        if (found) return found
    }
    return null
}

test('management users links only organizations in the active current-user memberships', async () => {
    currentUserActive = true
    expect(await organizationLinks()).toEqual({
        accessibleOrganizationIds: ['org-allowed'],
        links: ['/organizations?organizationId=org-allowed', '/organizations?organizationId=org-allowed'],
        fetchCalls: [{ id: 'admin', token: 'token', cache: 'no-store' }],
    })
})

test('inactive current user receives no accessible organization links', async () => {
    currentUserActive = false
    expect(await organizationLinks()).toEqual({
        accessibleOrganizationIds: [],
        links: [],
        fetchCalls: [{ id: 'admin', token: 'token', cache: 'no-store' }],
    })
})
