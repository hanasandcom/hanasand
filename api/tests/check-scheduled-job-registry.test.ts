import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'bun:test'
import { checkScheduledJobRegistry, collectCandidates, findUnregisteredCandidates, isScheduledCodeCandidate, scheduledJobScanRoots } from '../scripts/check-scheduled-job-registry.ts'
import { scheduledJobRegistryGuardrailEntries } from '../src/utils/systemCron.ts'

const repositoryRoot = path.resolve(import.meta.dir, '..', '..')

test('detects scheduler declarations without treating cron references as recurring work', () => {
    expect(isScheduledCodeCandidate('schedule(\'* * * * *\', refresh)')).toBe(true)
    expect(isScheduledCodeCandidate('setInterval(refresh, 30000)')).toBe(true)
    expect(isScheduledCodeCandidate('targetUrl?.startsWith(\'system:cron:\')')).toBe(false)
    expect(isScheduledCodeCandidate('description: \'Persisted daily UTC schedule (checked every minute)\'')).toBe(false)
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

test('registers operator workers and excludes cache, maintenance, and session-local timers', async() => {
    const registeredSources = new Set(scheduledJobRegistryGuardrailEntries().map(entry => entry.source))
    const workerSources = [
        'api/src/utils/events/analyzeIngestAccess.ts',
        'api/src/utils/events/dropRateAlert.ts',
        'api/src/utils/events/processor.ts',
    ]
    const maintenanceSources = [
        'api/src/handlers/logs/metrics.ts',
        'api/src/handlers/logs/mostActive.ts',
        'api/src/handlers/logs/tuning.ts',
        'api/src/utils/backgroundAnalytics.ts',
        'api/src/utils/db/overviewLive.ts',
        'api/src/utils/logs/warm.ts',
        'api/src/utils/traffic/history.ts',
    ]

    expect(findUnregisteredCandidates([path.join(repositoryRoot, 'api/src/handlers/hostConsole.ts')], registeredSources)).toEqual([])
    for (const source of workerSources) {
        expect(registeredSources.has(source)).toBe(true)
        expect(findUnregisteredCandidates([path.join(repositoryRoot, source)], registeredSources)).toEqual([])
    }
    for (const source of maintenanceSources) {
        const file = path.join(repositoryRoot, source)
        expect(isScheduledCodeCandidate(await readFile(file, 'utf8'))).toBe(true)
        expect(registeredSources.has(source)).toBe(false)
        expect(findUnregisteredCandidates([file], registeredSources)).toEqual([])
    }
})

test('fails on an unregistered candidate without an opt-in environment setting', async() => {
    const unregisteredSource = path.join(repositoryRoot, 'api/src/utils/unregisteredRecurringWorker.ts')

    await expect(checkScheduledJobRegistry([unregisteredSource])).rejects.toThrow(
        'api/src/utils/unregisteredRecurringWorker.ts',
    )
})

test('scans a directly configured Compose file for recurring work', async() => {
    expect(scheduledJobScanRoots).toContain('docker-compose.api.yml')
    const directory = await mkdtemp(path.join(os.tmpdir(), 'scheduled-job-registry-'))
    const composeFile = path.join(directory, 'docker-compose.api.yml')
    await writeFile(composeFile, 'services:\n  api:\n    command: schedule("* * * * *")\n')

    try {
        expect(await collectCandidates([composeFile])).toEqual([composeFile])
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
