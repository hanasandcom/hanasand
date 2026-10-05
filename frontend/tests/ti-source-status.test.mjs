import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'bun:test'

test('the main frontend does not own TI scraper control', () => {
    const route = new URL('../src/app/api/ti/scraper/control/route.ts', import.meta.url)
    assert.equal(existsSync(route), false)
    const backendHandler = new URL('../../api/src/handlers/ti/scraperControl.ts', import.meta.url)
    const backendRoutes = new URL('../../api/src/routes.ts', import.meta.url)
    assert.equal(existsSync(backendHandler), true)
    assert.match(readFileSync(backendRoutes, 'utf8'), /fastify\.(?:get|post)\('\/ti\/scraper\/control'/)
})
