import { beforeEach, expect, mock, test } from 'bun:test'

let accessResult: { valid: boolean, id?: string, authenticatedId?: string, error?: string }
let roleResult: { valid: boolean, error?: string }
let roleChecks = 0

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async () => accessResult,
}))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({
    default: async () => {
        roleChecks++
        return roleResult
    },
}))

const { authorizeRateLimitAdmin } = await import('../src/handlers/rateLimit/authorizeAdmin.ts')

beforeEach(() => {
    accessResult = { valid: true, id: 'admin', authenticatedId: 'actor' }
    roleResult = { valid: true }
    roleChecks = 0
})

test('returns unauthorized without checking the organization role for an invalid session', async () => {
    accessResult = { valid: false, error: 'Session expired.' }
    const reply = createReply()

    const result = await authorizeRateLimitAdmin({} as never, reply as never)

    expect(result).toBeNull()
    expect(reply.headers).toEqual({ 'cache-control': 'no-store' })
    expect(reply.statusCode).toBe(401)
    expect(reply.payload).toEqual({ error: 'Session expired.' })
    expect(roleChecks).toBe(0)
})

test('returns forbidden for an authenticated user without internal organization access', async () => {
    roleResult = { valid: false, error: 'Membership inactive.' }
    const reply = createReply()

    const result = await authorizeRateLimitAdmin({} as never, reply as never)

    expect(result).toBeNull()
    expect(reply.headers).toEqual({ 'cache-control': 'no-store' })
    expect(reply.statusCode).toBe(403)
    expect(reply.payload).toEqual({ error: 'Membership inactive.' })
    expect(roleChecks).toBe(1)
})

test('returns authorized access and requires an id only for settings writes', async () => {
    accessResult = { valid: true, authenticatedId: 'actor' }
    const reply = createReply()

    expect(await authorizeRateLimitAdmin({} as never, reply as never)).toEqual(accessResult)
    expect(reply.statusCode).toBe(200)
    expect(reply.headers).toEqual({ 'cache-control': 'no-store' })

    const settingsReply = createReply()
    expect(await authorizeRateLimitAdmin({} as never, settingsReply as never, { requireId: true })).toBeNull()
    expect(settingsReply.statusCode).toBe(401)
    expect(settingsReply.payload).toEqual({ error: 'Unauthorized.' })
    expect(roleChecks).toBe(1)
})

function createReply() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        payload: undefined as unknown,
        header(name: string, value: string) {
            this.headers[name.toLowerCase()] = value
            return this
        },
        status(code: number) {
            this.statusCode = code
            return this
        },
        send(payload: unknown) {
            this.payload = payload
            return this
        },
    }
}
