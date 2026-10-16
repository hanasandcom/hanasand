import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

type Scenario = 'success' | 'invalid' | 'missing' | 'no-session' | 'error'
type UpdateInput = { userId: string, password: string, ip: string, userAgent: string }

let scenario: Scenario = 'success'
let selfAuthenticated = true
let adminAuthorized = true
const updateCalls: UpdateInput[] = []

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async () => ({ valid: selfAuthenticated, id: 'self-user', authenticatedId: 'self-user', impersonating: false }),
}))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: adminAuthorized }) }))
mock.module('#utils/auth/password.ts', () => ({
    validatePassword: async () => scenario === 'invalid'
        ? { valid: false, error: 'Password does not meet policy.' }
        : { valid: true },
}))
mock.module('../src/handlers/user/updateUserPassword.ts', () => ({
    default: async (input: UpdateInput) => {
        updateCalls.push(input)
        if (scenario === 'error') throw new Error('database unavailable')
        if (scenario === 'missing') return { userFound: false }
        if (scenario === 'no-session') return { userFound: true, session: null }
        return { userFound: true, session: { token: 'restored-token', expires_at: '2030-01-01T00:00:00.000Z' } }
    },
}))

const { default: putSelf } = await import('../src/handlers/user/putSelf.ts')
const { default: putUser } = await import('../src/handlers/user/putUser.ts')

const app = Fastify()
app.put('/user/self', putSelf)
app.put('/user/:id', putUser)
afterAll(() => app.close())

beforeEach(() => {
    scenario = 'success'
    selfAuthenticated = true
    adminAuthorized = true
    updateCalls.length = 0
})

const routes = [
    { label: 'self', url: '/user/self', userId: 'self-user' },
    { label: 'admin', url: '/user/target-user', userId: 'target-user' },
]

async function changePassword(url: string) {
    return app.inject({
        method: 'PUT',
        url,
        headers: { 'user-agent': 'password-route-test' },
        payload: { password: 'New-password-123!' },
    })
}

for (const route of routes) {
    test(`${route.label} password route keeps its authorization gate`, async () => {
        if (route.label === 'self') selfAuthenticated = false
        else adminAuthorized = false
        const response = await changePassword(route.url)
        expect(response.statusCode).toBe(401)
        expect(updateCalls).toEqual([])
    })

    test(`${route.label} password route rejects invalid passwords before updating`, async () => {
        scenario = 'invalid'
        const response = await changePassword(route.url)
        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({ error: 'Password does not meet policy.' })
        expect(updateCalls).toEqual([])
    })

    test(`${route.label} password route reports a missing user`, async () => {
        scenario = 'missing'
        const response = await changePassword(route.url)
        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({ error: 'User not found.' })
        expect(updateCalls[0]).toMatchObject({ userId: route.userId, password: 'New-password-123!' })
    })

    test(`${route.label} password route reports when session restoration fails`, async () => {
        scenario = 'no-session'
        const response = await changePassword(route.url)
        expect(response.statusCode).toBe(206)
        expect(response.json()).toEqual({
            message: 'Password updated, and you were logged out. Logging you back in was not possible due to an unknown error.',
            error: 'Unable to login. Please try again later.',
        })
    })

    test(`${route.label} password route returns the restored session`, async () => {
        const response = await changePassword(route.url)
        expect(response.statusCode).toBe(201)
        expect(response.json()).toEqual({
            message: 'Password updated',
            token: 'restored-token',
            expires_at: '2030-01-01T00:00:00.000Z',
        })
        expect(updateCalls[0]).toEqual({
            userId: route.userId,
            password: 'New-password-123!',
            ip: '127.0.0.1',
            userAgent: 'password-route-test',
        })
    })

    test(`${route.label} password route maps update exceptions to the existing error response`, async () => {
        scenario = 'error'
        const originalError = console.error
        console.error = () => {}
        try {
            const response = await changePassword(route.url)
            expect(response.statusCode).toBe(500)
            expect(response.json()).toEqual({ error: 'Internal Server Error' })
        } finally {
            console.error = originalError
        }
    })
}
