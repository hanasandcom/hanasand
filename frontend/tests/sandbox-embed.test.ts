// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

test('Sandbox renders the Browser workspace in the Hanasand site shell', () => {
    const page = readFileSync(new URL('../src/app/sandbox/page.tsx', import.meta.url), 'utf8')

    expect(page).toContain('import SandboxApplication from \'./_browser/SandboxApplication\'')
    expect(page).toContain('<SandboxApplication />')
    expect(page).not.toContain('<iframe')
    expect(existsSync(new URL('../src/app/sandbox/_browser/browser/pageClient.tsx', import.meta.url))).toBe(true)
})
