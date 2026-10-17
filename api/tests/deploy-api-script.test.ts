import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

test('API-only deployment verifies release identity and rolls back a mismatched image', () => {
    const script = resolve(import.meta.dir, '../../scripts/tests/deploy-api-mock.sh')
    const result = spawnSync('sh', [script], { encoding: 'utf8', timeout: 15_000 })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('schema marker gates, API-only replacement, image identity, rollback, and exact-release recovery')
}, 20_000)
