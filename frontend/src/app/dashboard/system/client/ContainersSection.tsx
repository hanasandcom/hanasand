import { TerminalSquare } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { ContainerDetails } from './ContainerDetails'
import { ContainerRow } from './ContainerRow'
import { EmptyState, LinkButton } from './SystemUi'

export function ContainersSection({ containers, selectedContainer, unavailableReason, logs, logsReason, logsLoading, onSelect, onCopy, onRestart, onRefreshLogs }: {
    containers: DockerContainer[]
    selectedContainer: DockerContainer | null
    unavailableReason?: string
    logs: import('@/utils/logs/getLogs').RuntimeLog[]
    logsReason: string
    logsLoading: boolean
    onSelect: (container: DockerContainer) => void
    onCopy: (container: DockerContainer) => void
    onRestart: (container: DockerContainer) => void
    onRefreshLogs: (container: DockerContainer | null) => void
}) {
    return <section className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]' id='system-containers' data-system-containers>
        <DashboardPanel className='p-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div><h2 className='text-base font-semibold text-ui-text'>Docker containers</h2><p className='mt-1 text-sm text-ui-muted'>{containers.length} containers</p></div>
                <LinkButton href='/logs' icon={<TerminalSquare className='h-4 w-4' />} label='Open Logs' />
            </div>
            {containers.length ? <div className='mt-4 max-h-[58rem] overflow-auto'>
                <table className='min-w-[40rem] text-left text-sm xl:min-w-full'>
                    <thead className='sticky top-0 z-10 border-b border-ui-border bg-ui-panel text-xs uppercase text-ui-muted'><tr>
                        <th className='py-2 pr-3 font-semibold'>Container</th><th className='px-3 py-2 font-semibold'>Health</th>
                        <th className='px-3 py-2 font-semibold'>CPU</th><th className='px-3 py-2 font-semibold'>Memory</th>
                        <th className='px-3 py-2 font-semibold'>Ports</th><th className='py-2 pl-3 text-right font-semibold'>Actions</th>
                    </tr></thead>
                    <tbody className='divide-y divide-ui-border'>{containers.map((container) => <ContainerRow
                        key={container.id} container={container} selected={selectedContainer?.id === container.id}
                        globalReason={unavailableReason} onSelect={() => onSelect(container)}
                        onCopy={() => onCopy(container)} onRestart={() => onRestart(container)}
                    />)}</tbody>
                </table>
            </div> : <EmptyState title='Container inventory checking' body={unavailableReason || 'Docker inventory is reconnecting to the live container stream.'} />}
        </DashboardPanel>
        <ContainerDetails container={selectedContainer} globalReason={unavailableReason} logs={logs} logsReason={logsReason}
            logsLoading={logsLoading} onRefreshLogs={() => onRefreshLogs(selectedContainer)}
            onCopy={() => selectedContainer && onCopy(selectedContainer)} onRestart={() => selectedContainer && onRestart(selectedContainer)} />
    </section>
}
