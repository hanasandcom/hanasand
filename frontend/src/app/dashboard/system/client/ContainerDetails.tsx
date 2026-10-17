import Link from 'next/link'
import { ExternalLink, RefreshCcw } from 'lucide-react'
import type { RuntimeLog } from '@/utils/logs/getLogs'
import { DashboardPanel } from '@/components/dashboard/ui'
import { containerCpuMetric, containerDisplayName, containerHealth, containerMemoryMetric, formatDateTime, formatDuration } from '../systemPresentation'
import { formatLogTime, logLevelClass } from './presentation'
import { EmptyState, Fact, HealthPill, PortList } from './SystemUi'
import { ContainerActionGroup } from './ContainerActionGroup'

export function ContainerDetails({ container, globalReason, logs, logsReason, logsLoading, onRefreshLogs, onCopy, onRestart }: {
    container: DockerContainer | null
    globalReason?: string
    logs: RuntimeLog[]
    logsReason: string
    logsLoading: boolean
    onRefreshLogs: () => void
    onCopy: () => void
    onRestart: () => void
}) {
    if (!container) return <DashboardPanel className='p-4'>
        <EmptyState title='Select a container' body='Choose a container to inspect health, ports, restart count, and logs.' />
    </DashboardPanel>

    const cpu = containerCpuMetric(container, globalReason)
    const memory = containerMemoryMetric(container, globalReason)
    const health = containerHealth(container)
    return <DashboardPanel className='p-4' id='system-container-details'>
        <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
                <h2 className='break-all font-mono text-sm font-semibold text-ui-text'>{container.name}</h2>
                <p className='mt-1 text-xs text-ui-muted'>{containerDisplayName(container.name)}</p>
                <details className='mt-2 text-xs text-ui-muted'><summary className='cursor-pointer'>Image details</summary><p className='mt-1 break-all'>{container.image || 'image pending'}</p></details>
            </div>
            <HealthPill health={health} />
        </div>
        <div className='mt-4 grid gap-2 sm:grid-cols-2'>
            <Fact label='CPU' value={cpu.value} reason={cpu.reason} />
            <Fact label='Memory' value={memory.value} reason={memory.reason} />
            <Fact label='Uptime' value={formatDuration(container.uptime_seconds)} />
            <Fact label='Restarts' value={typeof container.restart_count === 'number' ? String(container.restart_count) : 'checking'} />
            <Fact label='Created' value={formatDateTime(container.created_at)} />
            <Fact label='Stats updated' value={formatDateTime(container.stats_updated_at)} />
        </div>
        <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
            <p className='font-semibold text-ui-text'>Ports</p><PortList ports={container.ports} className='mt-1' />
        </div>
        <ContainerActionGroup variant='full' leading={{ label: 'Logs', icon: <RefreshCcw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />, onClick: onRefreshLogs }} onCopy={onCopy} onRestart={onRestart} />
        <div className='mt-4 overflow-hidden rounded-md border border-ui-border bg-ui-canvas' data-system-container-logs-disclosure>
            <div className='flex items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-ui-text'>
                <span>Recent logs</span>
                <Link href={`/logs?service=${encodeURIComponent(container.name)}`} className='inline-flex items-center gap-1 text-xs font-semibold text-ui-primary hover:underline'>See more<ExternalLink className='h-3.5 w-3.5' /></Link>
            </div>
            {logsReason && <p className='mx-3 mt-2 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>{logsReason}</p>}
            <div className='max-h-72 overflow-auto border-t border-ui-border p-3 font-mono text-xs text-ui-text' data-system-container-log-tail>
                {logs.length ? logs.slice(0, 24).map((log) => <p key={log.id} className='mb-2 wrap-break-word'>
                    <span className='text-ui-muted'>{formatLogTime(log.created_at)}</span>{' '}<span className={logLevelClass(log.level)}>{log.level}</span>{' '}{log.message}
                </p>) : <p className='text-ui-muted'>{logsLoading ? 'Loading logs...' : 'No recent logs'}</p>}
            </div>
        </div>
    </DashboardPanel>
}
