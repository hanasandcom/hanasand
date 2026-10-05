// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nextConfig = require('../next.config.js')

test('root site sends TI pages to the dedicated application', async() => {
    const redirects = await nextConfig.redirects()
    const expected = new Map([
        ['/ti', 'https://ti.hanasand.com/ti'],
        ['/ti/:path*', 'https://ti.hanasand.com/ti/:path*'],
        ['/dashboard/ti', 'https://ti.hanasand.com/dashboard/ti'],
        ['/dashboard/ti/:path*', 'https://ti.hanasand.com/dashboard/ti/:path*'],
    ])

    for (const [source, destination] of expected) {
        assert.ok(redirects.some(redirect => redirect.source === source && redirect.destination === destination))
    }
    assert.equal(existsSync(new URL('../src/app/api/ti/scraper/control/route.ts', import.meta.url)), false)
})
