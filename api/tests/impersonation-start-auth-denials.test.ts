import { beforeEach, expect, test } from 'bun:test'
import { app, resetDenialFixture, state } from './impersonation-start-denials-fixture.ts'

beforeEach(resetDenialFixture)

test('scope denial remains enforced when its audit write fails', async () => {
    state.failSystemEventWrite = true

    const response = await app.inject({
        method: 'GET',
        url: '/api/profile',
        headers: {
            authorization: 'Bearer actor-token',
            id: 'admin-user',
            'x-impersonation-token': 'impersonation-token',
        },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ valid: false, impersonating: true, error: 'Impersonation scope does not allow this request.' })
})

test('impersonating actors cannot start a nested impersonation', async () => {
    state.actor = { valid: true, id: 'admin-user', impersonating: true }

    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        payload: { targetId: 'target-user', reason: 'Customer requested an access investigation.' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized.' })
    expect(state.queries).toHaveLength(0)
    expect(state.systemEvents).toHaveLength(0)
})

test('start denies the actor as a target before loading a user or writing an audit event', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/impersonation/start',
        payload: { targetId: 'admin-user' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
        error: 'You are already viewing your own account.',
        detail: { code: 'invalid_target_user', outcome: 'denied' },
    })
    expect(state.queries).toHaveLength(0)
    expect(state.systemEvents).toHaveLength(0)
})
