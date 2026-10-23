// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'

test('removed sandbox login path is left to normal Next.js routing', async () => {
    for (const pathname of ['/sandbox/login', '/sandbox/login/']) {
        const response = await proxy(new NextRequest(`https://hanasand.test${pathname}`))

        expect(response.headers.get('x-middleware-next')).toBe('1')
        expect(response.headers.get('location')).toBeNull()
    }
})
