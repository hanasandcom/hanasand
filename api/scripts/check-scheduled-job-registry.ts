import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { scheduledJobRegistryGuardrailEntries } from '../src/utils/systemCron.ts'

const repoRoot = path.resolve(import.meta.dir, '..', '..')
export const scheduledJobScanRoots = ['api/src', 'docker-compose.yml', 'docker-compose.api.yml']
const schedulerPattern = /\b(schedule\(|setInterval\(|startCanaryCollectionLoop\b)/i
const ignoredPattern = /(^|\/)(tests?|fixtures?|docs?|node_modules)(\/|$)/

export async function checkScheduledJobRegistry(candidateFiles?: string[]) {
    const candidates = candidateFiles ?? await collectCandidates(scheduledJobScanRoots.map(root => path.join(repoRoot, root)))

    const registeredSources = new Set(scheduledJobRegistryGuardrailEntries().map(entry => normalize(entry.source)))
    const unregistered = findUnregisteredCandidates(candidates, registeredSources)

    if (unregistered.length) {
        const message = [
            'Unregistered scheduled/background code candidates:',
            ...unregistered.map(file => `- ${file}`),
            'Add intentional recurring work to scheduledJobRegistryGuardrailEntries()/listUnifiedScheduledJobs, or add a narrow scanner exception.',
        ].join('\n')
        throw new Error(message)
    } else {
        console.log('Scheduled job registry guardrail passed.')
    }
    return unregistered
}

export async function collectCandidates(targets: string[]) {
    const candidates: string[] = []
    for (const target of targets) await collect(target, candidates)
    return candidates
}

export function findUnregisteredCandidates(candidates: string[], registeredSources: Set<string>) {
    return candidates
        .map(file => normalize(path.relative(repoRoot, file)))
        .filter(file => !registeredSources.has(file))
        .filter(file => !isAllowedIncidentalSchedulerFile(file))
        .sort()
}

export function isScheduledCodeCandidate(contents: string) {
    return schedulerPattern.test(contents)
}

async function collect(target: string, output: string[]) {
    if (ignoredPattern.test(normalize(path.relative(repoRoot, target)))) return
    const fileInfo = await stat(target).catch(() => null)
    if (fileInfo?.isFile()) {
        await addIfCandidate(target, output)
        return
    }
    if (!fileInfo?.isDirectory()) return

    const entries = await readdir(target, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
        const next = path.join(target, entry.name)
        if (entry.isDirectory()) {
            await collect(next, output)
        } else if (/\.(ts|tsx|js|mjs|yml|yaml)$/.test(entry.name)) {
            await addIfCandidate(next, output)
        }
    }
}

async function addIfCandidate(file: string, output: string[]) {
    const contents = await readFile(file, 'utf8').catch(() => '')
    if (isScheduledCodeCandidate(contents)) output.push(file)
}

function normalize(value: string) {
    return value.split(path.sep).join('/')
}

function isAllowedIncidentalSchedulerFile(file: string) {
    return [
        'api/src/plugins/ws.ts', // Socket, worker-lease, and live telemetry maintenance.
        'api/src/plugins/ws/browserStream.ts', // Keepalive timer owned by one browser stream connection.
        'api/src/plugins/ws/browserStreamRuntime.ts', // Metrics timer owned by one browser stream connection.
        'api/src/plugins/ws/ephemeralBrowserSession.ts', // Browser-run lease timer owned by one ephemeral session.
        'api/src/utils/cron.ts', // Dispatches the API jobs that the unified registry lists individually.
        // These timers exist only for an open WebSocket session and are cleared with that connection.
        'api/src/handlers/hostConsole.ts',
        'api/src/handlers/metrics/systemStream.ts',
        'api/src/handlers/vms/console.ts',
        'api/src/utils/db/browse.ts', // Expires idle database-browser clients; it does not run business work.
        'api/src/utils/db/browseConnection.ts', // Expires cached idle browser connections; no business work is scheduled.
        'api/src/handlers/traffic/legacyLive.ts',
        'api/src/utils/ws/resumableWorker.ts',
        // The remaining candidates are internal caches or derived-data maintenance without separate job controls.
        'api/src/handlers/logs/metrics.ts', // 5-second throughput cache refresh.
        'api/src/handlers/logs/mostActive.ts', // 30-second dashboard summary cache refresh.
        'api/src/handlers/logs/tuning.ts', // 15-second check; refreshes the snapshot only after it is stale.
        'api/src/utils/db/overview.ts', // 10-second live database overview cache refresh.
        'api/src/utils/db/overviewLive.ts', // 10-second live database overview cache refresh after the module split.
        'api/src/utils/logs/warm.ts', // 30-second error-log snapshot cache refresh.
        'api/src/utils/backgroundAnalytics.ts', // Derived log, rule-hit and traffic snapshots with mixed/adaptive cadence.
        'api/src/utils/traffic/history.ts', // Immediate plus 60-second durable history aggregation maintenance.
    ].includes(file)
}

if (import.meta.main) await checkScheduledJobRegistry()
