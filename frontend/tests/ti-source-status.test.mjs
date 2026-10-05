import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'bun:test'

test('the main frontend does not own TI scraper control', () => {
    const route = new URL('../src/app/api/ti/scraper/control/route.ts', import.meta.url)
    assert.equal(existsSync(route), false)
})
