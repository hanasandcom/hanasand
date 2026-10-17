import Link from 'next/link'
import { StopCircle } from 'lucide-react'
import { DashboardPanel, DashboardTable } from '@/components/dashboard/ui'
import { formatPercent } from '../systemPresentation'
import { EmptyState } from './SystemUi'

export function VirtualMachinesSection({ vms, metrics, runningCount, stoppedCount, onStopAll }: {
    vms: VM[]
    metrics: VMMetrics[]
    runningCount: number
    stoppedCount: number
    onStopAll: () => void
}) {
    return <DashboardPanel className='p-4' id='system-vms' data-system-vms>
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <div><h2 className='text-base font-semibold text-ui-text'>Virtual machines</h2>
                <p className='mt-1 text-sm text-ui-muted'>{runningCount} running, {stoppedCount} stopped, {vms.length - runningCount - stoppedCount} checking status.</p></div>
            <Link href='/vms' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-raised'>Open VM inventory</Link>
        </div>
        {vms.length ? <div className='mt-4 overflow-x-auto'><DashboardTable
            className='min-w-[40rem] text-left text-sm xl:min-w-full'
            headClassName='border-b border-ui-border text-xs uppercase text-ui-muted'
            bodyClassName='divide-y divide-ui-border'
            columnHeaders={<>
                <th className='py-2 pr-3 font-semibold'>Name</th><th className='px-3 py-2 font-semibold'>Owner</th>
                <th className='px-3 py-2 font-semibold'>CPU</th><th className='px-3 py-2 font-semibold'>Memory</th>
                <th className='px-3 py-2 font-semibold'>Status</th><th className='py-2 pl-3 text-right font-semibold'>Open</th>
            </>}
        >{vms.map((vm) => <VmTableRow key={vm.name} vm={vm} metrics={latestMetrics(vm.name, metrics)} />)}</DashboardTable></div> : <EmptyState title='VM inventory checking' body='Managed VM rows stream here as the inventory feed reports.' />}
        <details className='mt-4 rounded-md border border-ui-border bg-ui-raised' data-system-vm-danger-actions>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20 [&::-webkit-details-marker]:hidden'>
                <span>VM danger actions</span><span className='text-xs font-medium text-ui-muted'>Stop all VMs</span>
            </summary>
            <div className='flex flex-wrap items-center justify-between gap-3 border-t border-ui-border p-3'>
                <p className='max-w-2xl text-sm leading-6 text-ui-muted'>Only use during emergencies.</p>
                <button type='button' onClick={onStopAll} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-danger/35 bg-ui-raised/10 px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised/15' data-system-stop-all-vms>
                    <StopCircle className='h-4 w-4' />Stop all VMs
                </button>
            </div>
        </details>
    </DashboardPanel>
}

function latestMetrics(name: string, metrics: VMMetrics[]) {
    return metrics.filter((metric) => metric.name === name).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

function VmTableRow({ vm, metrics }: { vm: VM, metrics?: VMMetrics }) {
    const owner = vm.organization_name || vm.owner || vm.created_by || 'Unassigned'
    const status = (vm.status || '').toLowerCase()
    const cpu = status === 'offline' ? '—' : status === 'stopped' ? '0%' : metrics ? formatPercent(metrics.cpu_usage_percent) : 'Loading…'
    return <tr className='text-ui-text'>
        <td className='py-3 pr-3 font-semibold text-ui-text'>{vm.name}</td><td className='px-3 py-3'>{owner}</td>
        <td className='px-3 py-3'>{cpu}</td><td className='px-3 py-3'>{metrics ? `${metrics.ram_used_mb}/${metrics.ram_total_mb} MB` : vm.limits_memory || 'checking'}</td>
        <td className='px-3 py-3'>{vm.status || 'Checking'}</td><td className='py-3 pl-3 text-right'><Link href={`/vms/${vm.name}`} className='text-sm font-semibold text-ui-primary hover:underline'>Open</Link></td>
    </tr>
}
