import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

let internalMembers = new Set<string>()
let impersonating = false
let queryCount = 0
let queryEmailArguments: boolean[] = []

async function run(sql: string, values: unknown[] = []) {
    expect(sql).toContain('CASE WHEN')
    queryCount++
    queryEmailArguments.push(values[0] === true)
    return { rows: [{ id: 'internal-user', email: values[0] === true ? 'internal@example.com' : null }] }
}

mock.module('../src/utils/db.ts', () => ({ default: run }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async (req: FastifyRequest) => ({
        valid: req.headers.authorization === 'Bearer valid',
        impersonating,
    }),
}))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async (req: FastifyRequest) => ({ valid: internalMembers.has(String(req.headers.id || '')) }),
}))

const { default: getUsers } = await import('../src/handlers/user/getUsers.ts')

beforeEach(() => {
    internalMembers = new Set(['internal-reader'])
    impersonating = false
    queryCount = 0
    queryEmailArguments = []
})

async function request(id: string, token = 'Bearer valid') {
    const reply = {
        sent: false,
        code: 200,
        body: undefined as any,
        headers: {} as Record<string, string>,
        header(key: string, value: string) { this.headers[key] = value; return this },
        status(code: number) { this.code = code; return this },
        send(body: unknown) { this.body = body; this.sent = true; return this },
    }
    await getUsers({
        headers: { id, authorization: token },
        method: 'GET',
        url: '/users',
        routeOptions: { url: '/users' },
    } as unknown as FastifyRequest, reply as unknown as FastifyReply)
    return reply
}

test('global user list is unavailable to authenticated users outside the internal organization', async () => {
    const response = await request('regular-user')

    expect(response.code).toBe(403)
    expect(response.body).toEqual({ error: 'Forbidden.' })
    expect(response.headers['Cache-Control']).toBe('private, no-store')
    expect(queryCount).toBe(0)
})

test('internal readers can list users and see email when not impersonating', async () => {
    const response = await request('internal-reader')

    expect(response.code).toBe(200)
    expect(response.body).toEqual([{ id: 'internal-user', email: 'internal@example.com' }])
    expect(queryEmailArguments).toEqual([true])
})

test('impersonated internal readers can list users with email masked', async () => {
    impersonating = true
    const response = await request('internal-reader')

    expect(response.code).toBe(200)
    expect(response.body).toEqual([{ id: 'internal-user', email: null }])
    expect(queryEmailArguments).toEqual([false])
})

test('unauthenticated requests are rejected before checking internal membership', async () => {
    const response = await request('internal-reader', 'Bearer invalid')

    expect(response.code).toBe(401)
    expect(queryCount).toBe(0)
})
