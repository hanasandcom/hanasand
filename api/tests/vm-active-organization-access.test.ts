import { expect, mock, test } from 'bun:test'

let vmOrganizationId = 'cashflow'
let organizationAccess = true
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'cashflow-member' }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('../src/utils/contentOrganization.ts', () => ({
    requestedContentOrganization: (req: { headers: Record<string, string> }) => req.headers['x-organization-id'] || null,
    contentOrganizationAccess: async () => organizationAccess,
}))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => {
    if (sql.includes('SELECT name, owner, created_by, access_users, organization_id, deleted_at FROM vms')) {
        return { rows: [{ name: vmOrganizationId ? 'cashflow-vm' : 'personal-vm', organization_id: vmOrganizationId, deleted_at: null }] }
    }
    if (sql.includes('vm_user_has_access')) return { rows: [{ allowed: true }] }
    throw new Error(`Unexpected query: ${sql}`)
} }))

const { requireVmAccess } = await import('../src/utils/vms/access.ts')

function responseRecorder() {
    let statusCode = 200
    let body: unknown
    const reply = {
        sent: false,
        status(code: number) { statusCode = code; return this },
        send(value: unknown) { body = value; this.sent = true; return this },
    }
    return { reply, get statusCode() { return statusCode }, get body() { return body } }
}

test('an active organization cannot access a VM from another organization', async () => {
    vmOrganizationId = 'hanasand'
    organizationAccess = true
    const response = responseRecorder()

    const allowed = await requireVmAccess(
        { headers: { 'x-organization-id': 'cashflow' } } as never,
        response.reply as never,
        'cashflow-vm'
    )

    expect(allowed).toBeNull()
    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({ error: 'VM not found.' })
})

test('an active organization can access its own VM when the user has VM access', async () => {
    vmOrganizationId = 'cashflow'
    organizationAccess = true
    const response = responseRecorder()

    const allowed = await requireVmAccess(
        { headers: { 'x-organization-id': 'cashflow' } } as never,
        response.reply as never,
        'cashflow-vm'
    )

    expect(allowed).toEqual({ id: 'cashflow-member', admin: false, name: 'cashflow-vm' })
    expect(response.reply.sent).toBe(false)
})

test('personal workspace cannot access an organization VM even when the user is a VM member', async () => {
    vmOrganizationId = 'cashflow'
    const response = responseRecorder()

    const allowed = await requireVmAccess(
        { headers: {} } as never,
        response.reply as never,
        'cashflow-vm'
    )

    expect(allowed).toBeNull()
    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({ error: 'VM not found.' })
})

test('personal workspace can access a personal VM', async () => {
    vmOrganizationId = null
    const response = responseRecorder()

    const allowed = await requireVmAccess(
        { headers: {} } as never,
        response.reply as never,
        'personal-vm'
    )

    expect(allowed).toEqual({ id: 'cashflow-member', admin: false, name: 'personal-vm' })
    expect(response.reply.sent).toBe(false)
})
