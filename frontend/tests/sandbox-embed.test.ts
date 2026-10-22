// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

test('Sandbox keeps the site shell and loads its Browser UI from the Browser service', () => {
    const page = readFileSync(new URL('../src/app/sandbox/page.tsx', import.meta.url), 'utf8')

    expect(page).toContain('src=\'/sandbox/ui\'')
    expect(page).toContain('title=\'Sandbox\'')
    expect(page).not.toContain('BrowserPageClient')
    expect(existsSync(new URL('../src/app/sandbox/_browser', import.meta.url))).toBe(false)
})
