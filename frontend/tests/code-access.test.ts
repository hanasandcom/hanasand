import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isHanasandOrganizationMember } from '../src/utils/organizations/hanasandMembership'

test('code access requires active membership in the Hanasand organization', async() => {
    const originalFetch = globalThis.fetch
    const requests: { url: string, headers: Headers }[] = []
    const session = { id: 'member-id', token: 'member-token' }
    const isMember = () => isHanasandOrganizationMember(session.token, session.id, session)
    try {
        globalThis.fetch = (async(url: unknown, options?: RequestInit) => {
            requests.push({ url: String(url), headers: new Headers(options?.headers) })
            return Response.json({ member: true, canEdit: false })
        }) as typeof fetch
        assert.equal(await isMember(), true)
        assert.ok(requests[0].url.endsWith('/thesis/access'))
        assert.equal(requests[0].headers.get('Authorization'), 'Bearer member-token')
        assert.equal(requests[0].headers.get('id'), 'member-id')

        globalThis.fetch = (async() => Response.json({ member: false, canEdit: false })) as typeof fetch
        assert.equal(await isMember(), false)
        globalThis.fetch = (async() => Response.json({}, { status: 403 })) as typeof fetch
        assert.equal(await isMember(), false)
        globalThis.fetch = (async() => Response.json({}, { status: 503 })) as typeof fetch
        await assert.rejects(isMember(), /membership could not be checked/)
        globalThis.fetch = (async() => Response.json({ member: 'yes' })) as typeof fetch
        await assert.rejects(isMember(), /response was invalid/)
    } finally { globalThis.fetch = originalFetch }
})
