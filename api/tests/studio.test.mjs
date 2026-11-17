import { strict as assert } from 'node:assert'
import { mock, test } from 'bun:test'

mock.module('../src/utils/auth/session.ts', () => ({
    validateSession: async({ id, token }) => token === 'member-token'
        ? { user: { id }, session: { token }, organizationMember: id === 'member' } : null,
}))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ hasHanasandInternalPageAccess: async() => false }))

const { validStudio } = await import('../src/utils/studio.ts')
const { hanasandOrganizationSession } = await import('../src/utils/thesisAccess.ts')
const { getStudio, putStudio, postMarkdownImage, getMarkdownImage } = await import('../src/handlers/studio.ts')

function reply() {
    return { statusCode: 200, status(code) { this.statusCode = code; return this }, header() { return this }, send(value) { this.payload = value; return this } }
}

test('Studio and uploaded images require Hanasand organization membership', async() => {
    for (const handler of [getStudio, putStudio, postMarkdownImage, getMarkdownImage]) {
        const anonymous = reply()
        await handler({ headers: {}, log: { error() {} } }, anonymous)
        assert.equal(anonymous.statusCode, 401)
        const outsider = reply()
        await handler({ headers: { id: 'outsider', authorization: 'Bearer member-token' }, log: { error() {} } }, outsider)
        assert.equal(outsider.statusCode, 403)
    }
})

test('Studio rejects malformed revisions and image uploads before storage', async() => {
    assert.equal(validStudio({ title: 'Studio', body: '', revision: 0 }), true)
    assert.equal(validStudio({ title: 'Studio', body: '', revision: -1 }), false)
    assert.equal(validStudio({ title: '', body: '', revision: 0 }), false)
    const request = { headers: { id: 'member', authorization: 'Bearer member-token' }, body: { title: 'Studio', body: '', revision: -1 }, log: { error() {} } }
    const invalidDocument = reply()
    await putStudio(request, invalidDocument)
    assert.equal(invalidDocument.statusCode, 400)
    const invalidImage = reply()
    await postMarkdownImage({ ...request, body: { type: 'image/svg+xml', data: 'PHN2Zz4=' } }, invalidImage)
    assert.equal(invalidImage.statusCode, 400)
})

test('Studio resolves organization membership when a prior auth check cached only the session', async() => {
    const cached = { user: { id: 'member' }, session: { token: 'member-token' } }
    const request = { headers: {}, rateLimitSession: cached }
    const session = await hanasandOrganizationSession('member', 'member-token', undefined, request)
    assert.equal(session?.organizationMember, true)
    assert.equal(await hanasandOrganizationSession('outsider', 'member-token', undefined, request), null)
})
