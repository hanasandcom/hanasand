import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authenticateServiceAccount } from './service-account-auth.mjs'

test('keeps the authenticated account ID when cookie installation fails', async () => {
    let serviceAccountId = ''
    const context = { addCookies: async () => { throw new Error('cookie installation failed') } }
    const fetcher = async () => Response.json({ id: 'monitor-account', pages: ['/db'] })

    await assert.rejects(
        authenticateServiceAccount(context, id => { serviceAccountId = id }, fetcher),
        /cookie installation failed/,
    )
    assert.equal(serviceAccountId, 'monitor-account')
})
