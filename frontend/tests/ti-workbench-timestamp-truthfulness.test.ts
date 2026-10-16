import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { workbenchSource } from './workbench-source'

const page = fs.readFileSync(new URL('../src/app/dashboard/ti/workbench/page.tsx', import.meta.url), 'utf8')
const client = await workbenchSource(new URL('..', import.meta.url).pathname)
const adapter = fs.readFileSync(new URL('../src/app/dashboard/ti/workbench/alertAdapter.ts', import.meta.url), 'utf8')

test('missing delivery timestamps stay unavailable instead of becoming current time', () => {
    assert.doesNotMatch(page, /row\.updatedAt \|\| row\.latestEvent\?\.at \|\| row\.createdAt \|\| new Date\(\)\.toISOString\(\)/)
    assert.doesNotMatch(client, /payload\?\.deliveredAt \|\| payload\?\.testedAt \|\| new Date\(\)\.toISOString\(\)/)
    assert.match(client, /if \(!value\) return 'Time unavailable'/)
    assert.match(adapter, /attemptedAt: String\(row\.attemptedAt \?\? ''\)/)
})
