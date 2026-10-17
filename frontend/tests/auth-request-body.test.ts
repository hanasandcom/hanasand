import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { parseAuthJson, parseAuthRequest } from '../src/utils/auth/requestBody'

test('shared auth parser maps multipart fields and redirects to the supplied path', async () => {
    const form = new FormData()
    form.set('username', 'alice')
    form.set('password', 'secret')
    form.set('redirectPath', '/organizations')
    const request = new NextRequest('https://hanasand.com/api/auth/login', { method: 'POST', body: form })

    const result = await parseAuthRequest(request, values => ({
        id: String(values.get('username') || ''),
        password: String(values.get('password') || ''),
    }))

    assert.deepEqual(result, {
        body: { id: 'alice', password: 'secret' },
        redirectPath: '/organizations',
        wantsRedirect: true,
    })
})

test('shared auth parser keeps malformed JSON as a non-redirect null body', async () => {
    const request = new NextRequest('https://hanasand.com/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
    })

    assert.deepEqual(await parseAuthRequest(request, () => ({})), {
        body: null,
        redirectPath: '/dashboard',
        wantsRedirect: false,
    })
    assert.equal(parseAuthJson('{'), null)
})
