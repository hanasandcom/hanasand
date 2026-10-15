import { afterAll, beforeEach, expect, test } from 'bun:test'
import Fastify from 'fastify'

const configKeys = [
    'SSO_OIDC_ENABLED',
    'SSO_OIDC_CLIENT_ID',
    'SSO_OIDC_CLIENT_SECRET',
    'SSO_OIDC_AUTHORIZATION_URL',
    'SSO_OIDC_TOKEN_URL',
    'SSO_OIDC_USERINFO_URL',
    'SSO_OIDC_REDIRECT_URI',
    'SSO_STATE_SECRET',
]
const originalConfig = new Map(configKeys.map(key => [key, process.env[key]]))

const { getSsoStart, postSsoCallback } = await import('../src/handlers/auth/sso.ts')
const app = Fastify()
app.get('/auth/sso/start', getSsoStart)
app.post('/auth/sso/callback', postSsoCallback)

beforeEach(() => {
    for (const key of configKeys) delete process.env[key]
})

test('SSO start returns the configuration error when OIDC settings are missing', async () => {
    const response = await app.inject({ method: 'GET', url: '/auth/sso/start' })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
        error: 'SSO is not configured.',
        code: 'sso_not_configured',
        missing: configKeys,
    })
})

test('SSO callback returns the same configuration error before validating the request body', async () => {
    const response = await app.inject({ method: 'POST', url: '/auth/sso/callback', payload: {} })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
        error: 'SSO is not configured.',
        code: 'sso_not_configured',
        missing: configKeys,
    })
})

afterAll(async () => {
    await app.close()
    for (const [key, value] of originalConfig) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})
