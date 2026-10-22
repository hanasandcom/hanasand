import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyUnitTest } from './test-runner-policy.ts'

export type TestTask = {
    id: string
    title: string
    command: string[]
    env?: Record<string, string>
    requires?: 'server' | 'database' | 'network' | 'playwright'
    requiresPostgresFilterPort?: boolean
    guardProductionSmoke?: boolean
    inlineModule?: string
}

const bun = process.execPath
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const coreTasks: TestTask[] = [
    scriptTask('runtime-imports', 'API runtime import resolution', 'check-runtime-imports.ts'),
    scriptTask('status-feed', 'Status snapshots and monitoring failure', 'check-status-feed.ts'),
    scriptTask('status-summary', 'Bounded current status query', 'check-status-summary.ts'),
    scriptTask('recovery', 'Recovery boundaries and stale state', 'check-recovery.ts'),
    scriptTask('auth-boundary', 'Authentication outage classification', 'check-auth-boundary.ts'),
    scriptTask('database-pool-error', 'Checked-out connection recovery', 'check-database-pool-error.ts'),
    scriptTask('auth-rate-recovery', 'Bounded pre-handler recovery without action replay', 'check-auth-rate-recovery.ts'),
    scriptTask('session-recovery', 'Replica session validation before monitor convergence', 'check-session-recovery.ts'),
    scriptTask('notes-unit', 'Notes unit contract', 'smoke-notes.ts'),
    scriptTask('organization-internal-pages', 'Organization internal-page access contract', 'smoke-organization-internal-pages.ts'),
    scriptTask('organization-api', 'Organization API handler journeys', 'smoke-organizations-api.ts'),
    scriptTask('ai-action-policy', 'AI action policy contract', 'smoke-ai-action-policy.ts'),
    scriptTask('ai-repo-credentials', 'AI repository credential encryption contract', 'smoke-ai-repo-credentials.ts'),
    scriptTask('alert-automations', 'Alert automation contract', 'smoke-alert-automations.ts'),
    scriptTask('app-update', 'Desktop app update contract', 'smoke-app-update.ts'),
    scriptTask('mail-overview-timeout', 'Mail overview timeout contract', 'smoke-mail-overview-timeout.ts'),
    scriptTask('pwned-check', 'Pwned password dataset contract', 'smoke-pwned-check.ts'),
    scriptTask('db-overview', 'Database overview contract', 'smoke-db-overview.ts'),
    scriptTask('traffic-stream-scope', 'Traffic stream domain and cursor', 'check-traffic-stream-scope.ts'),
    scriptTask('traffic-query-cache', 'Traffic bounded cached queries', 'check-traffic-query-cache.ts'),
    scriptTask('traffic-contract', 'Traffic source and persistence contract', 'check-traffic-contract.mjs'),
    scriptTask('traffic-live', 'Traffic live stream contract', 'smoke-traffic-live.ts'),
    scriptTask('scheduled-job-registry', 'Scheduled job registry guardrail', 'check-scheduled-job-registry.ts'),
    scriptTask('automation-cadence', 'Automation schedule cadence and runtime bounds', 'check-automation-cadence.ts'),
    {
        ...scriptTask('scheduled-job-registry-smoke', 'Scheduled job registry smoke', 'smoke-scheduled-job-registry.ts'),
        env: {
            DB_BACKUP_DIR: path.join(process.env.TMPDIR || '/tmp', `hanasand-backup-registry-${process.pid}`),
            DB_BACKUP_ENABLED: 'false',
        },
    },
    scriptTask('lxd-lifecycle', 'LXD lifecycle contract', 'test-lxd-lifecycle.ts'),
]

const environmentTasks: TestTask[] = [
    { ...scriptTask('generated-builds', 'Build generated projects with their declared dependencies', 'check-generated-builds.ts'), requires: 'network' },
    guardedTask('rate-limits', 'Rate-limit API smoke', 'smoke-rate-limits.mjs', 'database'),
    guardedTask('notes', 'Notes API smoke', 'smoke-notes.mjs', 'database'),
    guardedTask('vm-targets', 'VM target smoke', 'smoke-vm-agent-targets.mjs', 'database'),
    guardedTask('vm-request-bridge', 'VM request bridge smoke', 'smoke-vm-request-bridge.mjs', 'database'),
    guardedTask('automations', 'Automation smoke', 'smoke-automations.mjs', 'server'),
]

export async function discoverTestTasks(): Promise<TestTask[]> {
    const unitTasks: TestTask[] = (await readdir(path.join(scriptDir, '../tests')))
        .filter(file => /\.test\.(ts|mjs)$/.test(file))
        .sort()
        .map(file => {
            const classification = classifyUnitTest(file)
            return {
                id: file.replace(/\.test\.(ts|mjs)$/, ''),
                title: `API behavior: ${file}`,
                command: [bun, 'test', `tests/${file}`],
                ...(classification.requiresDatabase ? { requires: 'database' as const } : {}),
                ...(classification.requiresPostgresFilterPort ? { requiresPostgresFilterPort: true } : {}),
            }
        })
    const playwrightTasks = await discoverPlaywrightTasks()
    return [...coreTasks, ...unitTasks, ...environmentTasks, ...playwrightTasks]
}

export function parseSelectedTaskIds(args: string[]) {
    const ids = new Set<string>()
    for (const arg of args) {
        if (arg.startsWith('--only=')) {
            for (const id of arg.slice('--only='.length).split(',')) {
                if (id.trim()) ids.add(id.trim())
            }
        }
    }
    return ids
}

async function discoverPlaywrightTasks(): Promise<TestTask[]> {
    const files = await readdir(scriptDir)
    return files
        .filter(file => file.includes('playwright') && file.endsWith('.ts'))
        .sort()
        .map(file => ({
            ...scriptTask(file.replace(/\.ts$/, ''), `Playwright scenario: ${file}`, file),
            requires: 'playwright' as const,
        }))
}

function scriptTask(id: string, title: string, scriptName: string): TestTask {
    return { id, title, command: [bun, `scripts/${scriptName}`] }
}

function guardedTask(id: string, title: string, scriptName: string, requires: TestTask['requires']): TestTask {
    return { ...scriptTask(id, title, scriptName), requires, guardProductionSmoke: true }
}
