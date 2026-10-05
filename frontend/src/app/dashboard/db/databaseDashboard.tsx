import { AlertTriangle, ArchiveRestore, CheckCircle2, Clock3, DatabaseBackup, HardDrive, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import Button from '@/components/misc/button'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { DatabaseOverview } from '@/utils/db/internal'
import DatabaseWorkbench from './databaseWorkbench'
import DatabaseRefresh from './databaseRefresh'
import DatabaseInventory from './databaseInventory'
import DatabaseStoragePanel from './databaseStoragePanel'
import DatabaseQueriesDisclosure from './databaseQueriesDisclosure'


export function DatabaseDashboard({ overview, serviceAccount = false }: { overview: DatabaseOverview, serviceAccount?: boolean }) {
    const storage = overview.storage
    const fresh = Boolean(storage && !storage.stale)
    const disk = fresh ? storage?.disk : null
    const issues = storage?.instances.filter(instance => instance.status !== 'healthy') || []
    const daily = disk?.dailyGrowthBytes
    const days = disk?.daysUntilFull
    const querySummary = overview.querySummary || {
        count: overview.queries.length,
        longRunningCount: overview.queries.filter(query => query.isLongRunning).length,
        longestDurationSeconds: overview.longestQuery?.durationSeconds ?? null,
    }


    return <DashboardPage>
        <DatabaseRefresh />
        <DatabaseWorkbench overview={{ status: overview.status, generatedAt: overview.generatedAt, clusters: overview.clusters, health: overview.health }} serviceAccount={serviceAccount}>
            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4' aria-label='Storage health' data-db-monitor-metrics data-clusters={overview.clusterCount} data-databases={overview.databaseCount} data-storage-bytes={overview.totalSizeBytes}>
                <MetricCard icon={<HardDrive />} label='Disk free' value={disk ? formatBytes(disk.availableBytes) : 'Unavailable'} detail={disk ? `${formatBytes(disk.totalBytes)} total · ${storage?.host}` : 'Storage measurements unavailable'} />
                <MetricCard icon={<TrendingUp />} label='Growth / day' value={daily == null ? 'Measuring' : `${daily < 0 ? '−' : '+'}${formatBytes(Math.abs(daily))}`} detail={disk ? `Net disk change · ${Math.min(24, disk.sampleSeconds / 3600).toFixed(1)}h sampled` : 'No recent measurement'} />
                <MetricCard icon={<Clock3 />} label='Disk full in' value={!disk || daily == null ? 'Not enough history' : days == null ? 'Not growing' : days < 1 ? `${Math.max(1, Math.round(days * 24))} hours` : `${Math.round(days)} days`} detail='Estimated at the measured rate' />
                <MetricCard icon={fresh && !issues.length ? <CheckCircle2 /> : <AlertTriangle />} label='Database health' value={!fresh ? 'Not verified' : issues.length ? `${issues.length} need attention` : 'Healthy'} detail={storage ? `Checked ${formatDateTime(storage.sampledAt)}` : 'Inventory unavailable'} />
            </section>
        </DatabaseWorkbench>

        <DatabaseStoragePanel stale={Boolean(storage?.stale)} actions={<DatabaseActions />}>
            {storage ? <DatabaseInventory instances={storage.instances} stale={!fresh} /> : <p className='p-5 text-sm text-ui-muted'>Database inventory unavailable.</p>}
        </DatabaseStoragePanel>


        <DatabaseQueriesDisclosure
            count={querySummary.count}
            longRunningCount={querySummary.longRunningCount}
            longestDurationSeconds={querySummary.longestDurationSeconds}
            thresholdSeconds={overview.longRunningThresholdSeconds}
            checkedAt={overview.generatedAt}
        />
    </DashboardPage>
}

export function DatabaseActions() {
    return (
        <div className='flex flex-wrap gap-2'>
            <Button path='/db/backups' icon={<DatabaseBackup className='h-4 w-4' />} text='Backups' variant='secondary' />
            <Button path='/db/restore' icon={<ArchiveRestore className='h-4 w-4' />} text='Restore' variant='secondary' />
        </div>
    )
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return <DashboardPanel className='min-w-0 p-4'>
        <div className='flex items-center gap-2 text-sm text-ui-muted'><span aria-hidden className='text-ui-primary [&>svg]:h-4 [&>svg]:w-4'>{icon}</span>{label}</div>
        <p className='mt-3 text-xl font-semibold tabular-nums'>{value}</p><p className='mt-2 text-xs text-ui-muted'>{detail}</p>
    </DashboardPanel>
}

function formatBytes(bytes: number | null) {
    if (bytes === null || !Number.isFinite(bytes)) return '—'
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1000 && index < units.length - 1) {
        value /= 1000
        index++
    }
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) + ' UTC'
}
