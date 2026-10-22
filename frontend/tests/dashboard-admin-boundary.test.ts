import { strict as assert } from 'node:assert'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'
import { proxy } from '../src/proxy'

test('internal pages appear only for organization access in dashboard navigation', () => {
    const guestLinks = navigationLinks(getDashboardNavigation({ id: 'member' }))
    const userRoleLinks = navigationLinks(getDashboardNavigation({
        id: 'role-only-user',
    }))
    const organizationLinks = navigationLinks(getDashboardNavigation({
        id: 'member',
        canViewInternalPages: true, canReviewIntel: true, hasVMs: true,
    }))

    const internalPages = [
        ['/logs', 'Log Dashboard'],
        ['/logs/realtime', 'Realtime'],
        ['/traffic', 'Overview'],
        ['/ti/runs', 'Collection'],
        ['/system/ai', 'AI Metrics'],
        ['/vulnerabilities', 'Vulnerabilities'],
        ['/db', 'Database'],
        ['/db/backups', 'Backups'],
        ['/management/users', 'Users'],
        ['/management/service-accounts', 'Service Accounts'],
        ['/content/articles', 'Articles'],
        ['/content/thoughts', 'Thoughts'],
    ] as const

    for (const [href, label] of internalPages) {
        assert.equal(guestLinks.some(link => link.href === href), false, `${label} should require organization access.`)
        assert.equal(userRoleLinks.some(link => link.href === href), false, `${label} should not be granted by account roles.`)
        assert.equal(organizationLinks.some(link => link.href === href), true, `${label} should be available to Hanasand owners and editors.`)
    }

})

test('internal page route accepts Hanasand editors and rejects user-role-only access', async() => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ target: URL, headers: Headers }> = []
    const tokenById = new Map([['role-only-user', 'token-role-only'], ['hanasand-editor', 'token-org-editor']])
    globalThis.fetch = (async(input: RequestInfo | URL, init?: RequestInit) => {
        const target = new URL(String(input))
        calls.push({ target, headers: new Headers(init?.headers) })
        if (target.pathname.includes('/auth/token/')) {
            const id = target.pathname.split('/').pop() || ''
            const token = tokenById.get(id)
            if (!token) return Response.json({}, { status: 401 })
            const canViewInternalPages = id === 'hanasand-editor'
            return Response.json({ token, canViewInternalPages, canEditInternalPages: canViewInternalPages })
        }
        if (target.pathname.endsWith('/management/organizations')) {
            const allowed = new Headers(init?.headers).get('id') === 'hanasand-editor'
            return Response.json({ allowed, canEdit: allowed })
        }
        throw new Error(`Unexpected request ${target}`)
    }) as typeof fetch

    const makeRequest = (id: string, token: string) => new NextRequest('https://hanasand.com/logs/realtime', {
        headers: {
            cookie: `id=${id}; access_token=${token}; roles=%5B%7B%22id%22%3A%22system_admin%22%7D%5D`,
            DPoP: `proof-${id}`,
            'x-device-proof-url': 'https://hanasand.com/logs/realtime',
            'x-device-proof-method': 'GET',
        },
    })

    try {
        const roleOnlyResponse = await proxy(makeRequest('role-only-user', 'token-role-only'))
        assert.equal(roleOnlyResponse.status, 307)
        const denialUrl = new URL(roleOnlyResponse.headers.get('location') || '')
        assert.equal(denialUrl.searchParams.get('notAllowed'), 'true')
        assert.equal(denialUrl.searchParams.get('from'), '/logs/realtime')

        const editorResponse = await proxy(makeRequest('hanasand-editor', 'token-org-editor'))
        assert.equal(editorResponse.status, 200)
        assert.equal(editorResponse.headers.has('location'), false)
        const editorValidation = calls.find(({ target }) => target.pathname.endsWith('/auth/token/hanasand-editor'))
        assert.equal(editorValidation?.headers.get('DPoP'), 'proof-hanasand-editor')
        assert.equal(editorValidation?.headers.get('x-device-proof-url'), 'https://hanasand.com/logs/realtime')
        assert.equal(editorValidation?.headers.get('x-device-proof-method'), 'GET')

        const customerResponse = await proxy(new NextRequest('https://hanasand.com/findings', {
            headers: { cookie: 'id=role-only-user; access_token=token-role-only' },
        }))
        assert.equal(customerResponse.status, 200)
        assert.equal(customerResponse.headers.has('location'), false)
        assert(calls.some(({ target, headers }) => target.pathname.endsWith('/auth/token/role-only-user')
            && headers.get('authorization') === 'Bearer token-role-only'
            && headers.get('DPoP') === 'proof-role-only-user'))
    } finally {
        globalThis.fetch = originalFetch
    }
})
