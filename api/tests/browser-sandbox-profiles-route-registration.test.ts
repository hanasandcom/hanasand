import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

test('production API routes register canonical and legacy profile endpoints', async () => {
    const fixture = path.join(import.meta.dir, 'fixtures/browser-sandbox-profiles-route-check.ts')
    const apiDirectory = path.resolve(import.meta.dir, '..')
    const result = spawnSync(process.execPath, [fixture], {
        cwd: apiDirectory,
        env: { ...process.env, API_HTTP_ONLY: '1' },
        encoding: 'utf8',
        timeout: 15_000,
    })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Production browser profile routes registered.')
})
