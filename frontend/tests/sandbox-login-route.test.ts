// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'

test('removed sandbox login path returns a real not-found response', async () => {
    for (const pathname of ['/sandbox/login', '/sandbox/login/']) {
        const response = await proxy(new NextRequest(`https://hanasand.test${pathname}`))

        expect(response.status).toBe(404)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(await response.text()).toBe('Not Found')
    }
})
