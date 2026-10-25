import { ExternalLink } from 'lucide-react'
import { containerCpuMetric, containerDisplayName, containerHealth, containerMemoryMetric } from '../systemPresentation'
import { HealthPill, MetricText, PortList } from './SystemUi'
import { ContainerActionGroup } from './ContainerActionGroup'
import { isProtectedLogsContainer } from './protectedLogsContainer'

export function ContainerRow({ container, selected, globalReason, onSelect, onCopy, onRestart }: {
    container: DockerContainer
    selected: boolean
    globalReason?: string
    onSelect: () => void
    onCopy: () => void
    onRestart: () => void
}) {
    const cpu = containerCpuMetric(container, globalReason)
    const memory = containerMemoryMetric(container, globalReason)
    const health = containerHealth(container)
    const displayName = containerDisplayName(container.name)

    return <tr className={`cursor-pointer align-top text-ui-text transition-colors hover:bg-ui-primary/5 ${selected ? 'bg-ui-primary/10' : ''}`} onClick={onSelect} aria-selected={selected} data-container-row>
        <td className='py-3 pr-3'>
            <button type='button' onClick={onSelect} className='text-left'>
                <span className='block break-all font-mono text-xs font-semibold text-ui-text'>{container.name}</span>
                <span className='mt-1 block text-[11px] text-ui-muted'>{displayName}</span>
            </button>
        </td>
        <td className='px-3 py-3'><HealthPill health={health} /></td>
        <td className='px-3 py-3'><MetricText metric={cpu} /></td>
        <td className='px-3 py-3'><MetricText metric={memory} /></td>
        <td className='px-3 py-3'><PortList ports={container.ports} /></td>
        <td className='py-3 pl-3'><ContainerActionGroup variant='compact' displayName={displayName}
            leading={{ label: `Inspect ${displayName}`, icon: <ExternalLink className='h-4 w-4' />, onClick: onSelect }}
            onCopy={onCopy} onRestart={onRestart} showRestart={!isProtectedLogsContainer(container.name)} /></td>
    </tr>
}
