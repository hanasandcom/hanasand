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
        {vms.length ? <>
            <ul className='mt-4 grid min-w-0 gap-3 xl:hidden' aria-label='Virtual machines'>
                {vms.map((vm) => <VmCard key={vm.name} vm={vm} metrics={latestMetrics(vm.name, metrics)} />)}
            </ul>
            <div className='mt-4 hidden min-w-0 xl:block'><DashboardTable
                className='min-w-full text-left text-sm'
                headClassName='border-b border-ui-border text-xs uppercase text-ui-muted'
                bodyClassName='divide-y divide-ui-border'
                columnHeaders={<>
                    <th className='py-2 pr-3 font-semibold'>Name</th><th className='px-3 py-2 font-semibold'>Owner</th>
                    <th className='px-3 py-2 font-semibold'>CPU</th><th className='px-3 py-2 font-semibold'>Memory</th>
                    <th className='px-3 py-2 font-semibold'>Status</th><th className='py-2 pl-3 text-right font-semibold'>Open</th>
                </>}
            >{vms.map((vm) => <VmTableRow key={vm.name} vm={vm} metrics={latestMetrics(vm.name, metrics)} />)}</DashboardTable></div>
        </> : <EmptyState title='VM inventory checking' body='Managed VM rows stream here as the inventory feed reports.' />}
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
    const { owner, cpu, memory } = vmFields(vm, metrics)
    return <tr className='text-ui-text'>
        <td className='py-3 pr-3 font-semibold text-ui-text'>{vm.name}</td><td className='px-3 py-3'>{owner}</td>
        <td className='px-3 py-3'>{cpu}</td><td className='px-3 py-3'>{memory}</td>
        <td className='px-3 py-3'>{vm.status || 'Checking'}</td><td className='py-3 pl-3 text-right'><Link href={`/vms/${vm.name}`} className='text-sm font-semibold text-ui-primary hover:underline'>Open</Link></td>
    </tr>
}

function VmCard({ vm, metrics }: { vm: VM, metrics?: VMMetrics }) {
    const { owner, cpu, memory } = vmFields(vm, metrics)
    return <li className='grid min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm text-ui-text'>
        <div className='flex min-w-0 items-start justify-between gap-3'>
            <h3 className='min-w-0 wrap-break-word font-semibold'>{vm.name}</h3>
            <span className='max-w-[45%] shrink-0 rounded-md border border-ui-border bg-ui-canvas px-2 py-1 text-right text-xs font-medium text-ui-muted wrap-break-word'>{vm.status || 'Checking'}</span>
        </div>
        <dl className='grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-ui-border pt-3'>
            <div className='min-w-0'><dt className='text-xs text-ui-muted'>Owner</dt><dd className='mt-0.5 wrap-break-word'>{owner}</dd></div>
            <div className='min-w-0'><dt className='text-xs text-ui-muted'>CPU</dt><dd className='mt-0.5'>{cpu}</dd></div>
            <div className='min-w-0'><dt className='text-xs text-ui-muted'>Memory</dt><dd className='mt-0.5 wrap-break-word'>{memory}</dd></div>
            <div className='flex items-end justify-end'><Link href={`/vms/${vm.name}`} aria-label={`Open ${vm.name}`} className='inline-flex min-h-9 items-center rounded-md px-3 font-semibold text-ui-primary hover:bg-ui-canvas hover:underline'>Open</Link></div>
        </dl>
    </li>
}

function vmFields(vm: VM, metrics?: VMMetrics) {
    const owner = vm.organization_name || vm.owner || vm.created_by || 'Unassigned'
    const status = (vm.status || '').toLowerCase()
    const cpu = status === 'offline' ? '—' : status === 'stopped' ? '0%' : metrics ? formatPercent(metrics.cpu_usage_percent) : 'Loading…'
    const memory = metrics ? `${metrics.ram_used_mb}/${metrics.ram_total_mb} MB` : vm.limits_memory || 'checking'
    return { owner, cpu, memory }
}
