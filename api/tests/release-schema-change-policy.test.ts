import { spawnSync } from 'node:child_process'
import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

test('deployment preflight isolates host reconciliation from application schema changes', () => {
    const script = resolve(import.meta.dir, '../../scripts/tests/release-schema-change-policy.sh')
    const result = spawnSync('sh', [script], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('classifies VM host reconciliation and real DDL correctly')
})
