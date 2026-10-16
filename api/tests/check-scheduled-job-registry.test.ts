import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'bun:test'
import { findUnregisteredCandidates, isScheduledCodeCandidate } from '../scripts/check-scheduled-job-registry.ts'
import { scheduledJobRegistryGuardrailEntries } from '../src/utils/systemCron.ts'

const repositoryRoot = path.resolve(import.meta.dir, '..', '..')

test('detects scheduler declarations without treating cron references as recurring work', () => {
    expect(isScheduledCodeCandidate('schedule(\'* * * * *\', refresh)')).toBe(true)
    expect(isScheduledCodeCandidate('setInterval(refresh, 30000)')).toBe(true)
    expect(isScheduledCodeCandidate('targetUrl?.startsWith(\'system:cron:\')')).toBe(false)
    expect(isScheduledCodeCandidate('export async function runDueWebScan() {}')).toBe(false)
})

test('recognizes a registered recurring worker and ignores ordinary helpers', async() => {
    const registeredSources = new Set(scheduledJobRegistryGuardrailEntries().map(entry => entry.source))
    const recurringSource = 'api/src/utils/refresh/fp.ts'
    const utilitySource = 'api/src/utils/automationAccess.ts'
    const recurringCode = await readFile(path.join(repositoryRoot, recurringSource), 'utf8')
    const utilityCode = await readFile(path.join(repositoryRoot, utilitySource), 'utf8')

    expect(registeredSources.has(recurringSource)).toBe(true)
    expect(registeredSources.has(utilitySource)).toBe(false)
    expect(isScheduledCodeCandidate(recurringCode)).toBe(true)
    expect(isScheduledCodeCandidate(utilityCode)).toBe(false)
    expect(findUnregisteredCandidates([path.join(repositoryRoot, recurringSource)], registeredSources)).toEqual([])
})

test('excludes connection-scoped timers but keeps unregistered background refreshers visible', () => {
    const registeredSources = new Set(scheduledJobRegistryGuardrailEntries().map(entry => entry.source))

    expect(findUnregisteredCandidates([path.join(repositoryRoot, 'api/src/handlers/hostConsole.ts')], registeredSources)).toEqual([])
    expect(findUnregisteredCandidates([path.join(repositoryRoot, 'api/src/utils/logs/warm.ts')], registeredSources)).toEqual(['api/src/utils/logs/warm.ts'])
})
