import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const events: Array<Record<string, any>> = []
const mails: Array<Record<string, any>> = []
let vm: Record<string, unknown> | null = null
let actorOwner = 'owner'
let passwordValid = true
let auditFails = false
let mailFails = false
let organizationAdmin = false
let locationAvailable = true
let hostCalls: Array<{ host: string, name: string, suffix: string, body: unknown }> = []

mock.module('bcrypt', () => ({ default: { compare: async (candidate: string) => passwordValid && candidate === 'account-password-fixture' } }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({
    valid: req.headers.id !== undefined,
    id: req.headers.id,
    authenticatedId: req.headers.authenticatedid || req.headers.id,
    impersonating: req.headers.impersonating === 'true',
}) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async (req: any) => ({ valid: req.headers.id === 'platform-admin' }) }))
mock.module('#utils/auth/sessionNetwork.ts', () => ({ sessionNetwork: async () => ({
    ip: '203.0.113.4', private_ip: null,
    network: locationAvailable ? { provider: 'Example ISP', country: 'Norway', country_code: 'NO', region: 'Vestland', city: 'Bergen' } : null,
}) }))
mock.module('#utils/mail/system.ts', () => ({ sendSystemMail: async (mail: Record<string, any>) => {
    if (mailFails) throw new Error('Mail unavailable')
    mails.push(mail)
} }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async (_req: unknown, event: Record<string, any>) => {
    if (auditFails) throw new Error('Audit unavailable')
    events.push(event)
} }))
mock.module('#utils/vms/hostTransport.ts', () => ({ hostJson: async (host: string, name: string, suffix: string, body: unknown) => {
    hostCalls.push({ host, name, suffix, body })
    return { password: 'vm-password-fixture' }
} }))
mock.module('#utils/mail/helpers.ts', () => ({ addressForUser: (id: string) => `${id}@example.test` }))
mock.module('#db', () => ({
    queryOnce: async (sql: string) => sql.includes('SELECT password, name FROM users')
        ? { rows: [{ password: 'hash-fixture', name: 'Owner Name' }] }
        : { rows: [{ email: 'owner@example.test' }] },
    default: async (sql: string, params: unknown[] = []) => {
        if (sql.includes('FROM vms')) return { rows: vm ? [{ ...vm, name: params[0] === 'my-vm' ? 'my-vm' : vm.name }] : [] }
        if (sql.includes('FROM organization_members')) return { rows: organizationAdmin ? [{}] : [] }
        return { rows: [] }
    },
}))

const { default: handler } = await import('../src/handlers/vms/postSudoPassword.ts')
const app = Fastify()
app.post('/vm/:id/sudo-password', handler)

beforeEach(() => {
    events.length = 0
    mails.length = 0
    hostCalls = []
    actorOwner = 'owner'
    vm = { name: 'my-vm', owner: actorOwner, organization_id: null, deleted_at: null, primary_host: 'inspur' }
    passwordValid = true
    auditFails = false
    mailFails = false
    organizationAdmin = false
    locationAvailable = true
})

afterAll(async () => { await app.close() })

function request(headers: Record<string, string> = {}, currentPassword: string | undefined = 'account-password-fixture') {
    return app.inject({
        method: 'POST', url: '/vm/my-vm/sudo-password',
        headers: { id: 'owner', ...headers },
        payload: currentPassword === undefined ? {} : { currentPassword },
    })
}

test('only an authenticated VM owner who reauthenticates can reveal the password', async () => {
    const denied = await request({}, 'wrong-password')
    expect(denied.statusCode).toBe(403)
    expect(hostCalls).toHaveLength(0)

    vm = { ...vm!, owner: 'someone-else' }
    const notOwner = await request()
    expect(notOwner.statusCode).toBe(404)
    expect(hostCalls).toHaveLength(0)

    vm = { ...vm!, organization_id: 'organization-1' }
    const sharedMember = await request()
    expect(sharedMember.statusCode).toBe(404)
    expect(hostCalls).toHaveLength(0)

    organizationAdmin = true
    vm = { ...vm!, owner: 'owner' }
    const shown = await request()
    expect(shown.statusCode).toBe(200)
    expect(shown.json()).toEqual({ password: 'vm-password-fixture' })
    expect(shown.headers['cache-control']).toBe('no-store, private')
    expect(hostCalls).toEqual([{ host: 'inspur', name: 'my-vm', suffix: '/sudo-password', body: {} }])
})

test('audits the VM, user, timestamp, IP and approximate location without the secret', async () => {
    const result = await request()
    expect(result.statusCode).toBe(200)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
        actionType: 'vm.sudo_password.viewed', actorId: 'owner', targetType: 'vm', targetId: 'my-vm',
        context: {
            schemaVersion: 'vm.sudo_password.view.v1',
            ip: '203.0.113.4',
            location: { city: 'Bergen', region: 'Vestland', country: 'Norway' },
        },
    })
    expect(typeof events[0]?.context.viewedAt).toBe('string')
    expect(typeof events[0]?.context.reauthenticatedAt).toBe('string')
    expect(JSON.stringify(events[0])).not.toContain('vm-password-fixture')
    expect(mails[0]?.to).toBe('owner@example.test')
    expect(mails[0]?.textBody).toContain('VM: my-vm')
    expect(mails[0]?.textBody).toContain('User: Owner Name (@owner)')
    expect(mails[0]?.textBody).toContain('IP address: 203.0.113.4')
    expect(mails[0]?.textBody).toContain('City: Bergen')
    expect(mails[0]?.textBody).not.toContain('vm-password-fixture')
})

test('platform administrators can reveal for an owner and the email goes to the VM owner', async () => {
    const result = await request({ id: 'platform-admin' })
    expect(result.statusCode).toBe(200)
    expect(events[0]?.actorId).toBe('platform-admin')
    expect(mails[0]?.to).toBe('owner@example.test')
    expect(mails[0]?.textBody).toContain('User: Owner Name (@platform-admin)')
})

test('marks audit location as approximate and explicitly unavailable when GeoIP has no result', async () => {
    locationAvailable = false
    const result = await request()
    expect(result.statusCode).toBe(200)
    expect(events[0]?.context.location).toEqual({
        precision: 'approximate', status: 'unavailable', provider: null,
        city: null, region: null, country: null, countryCode: null,
    })
    expect(mails[0]?.textBody).toContain('City: Unavailable')
    expect(mails[0]?.textBody).toContain('Location is approximate')
})

test('fails closed if audit or security email is unavailable', async () => {
    auditFails = true
    expect((await request()).statusCode).toBe(503)
    expect(mails).toHaveLength(0)

    auditFails = false
    mailFails = true
    expect((await request()).statusCode).toBe(503)
})

test('does not permit impersonated or API-key sessions and blocks deleted VMs', async () => {
    expect((await request({ impersonating: 'true' })).statusCode).toBe(403)
    expect((await request({ authenticatedid: 'different-user' })).statusCode).toBe(403)
    vm = { ...vm!, deleted_at: new Date().toISOString() }
    expect((await request()).statusCode).toBe(409)
    expect(hostCalls).toHaveLength(0)
})
