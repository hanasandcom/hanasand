// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
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

test('Sandbox keeps the site shell and loads its Browser UI from the Browser service', () => {
    const page = readFileSync(new URL('../src/app/sandbox/page.tsx', import.meta.url), 'utf8')

    expect(page).toContain('src=\'/sandbox/ui\'')
    expect(page).toContain('title=\'Sandbox\'')
    expect(page).not.toContain('BrowserPageClient')
    expect(existsSync(new URL('../src/app/sandbox/_browser', import.meta.url))).toBe(false)
})
