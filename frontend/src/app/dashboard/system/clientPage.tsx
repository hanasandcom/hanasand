'use client'

import { useMemo, useState } from 'react'
import { Cpu, HardDrive, MemoryStick, ServerCog } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ErrorNotice from '@/components/error/errorNotice'
import { AppConfirmDialog } from '@/components/ui/appDialog'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import stopAllVms from '@/utils/vms/fetch/stopAllVms'
import restartDocker from '@/utils/vms/fetch/restartDocker'
import { containerHealth, formatBytes, normalizeDockerTelemetry } from './systemPresentation'
import { ContainersSection } from './client/ContainersSection'
import { VirtualMachinesSection } from './client/VirtualMachinesSection'
import { SystemOverviewControls } from './client/SystemOverviewControls'
import { SystemTriage } from './client/SystemTriage'
import { TelemetryWarning } from './client/SystemUi'
import { useContainerLogs } from './hooks/useContainerLogs'
import { useSystemTelemetry } from './hooks/useSystemTelemetry'
import { systemExpiredSessionPath } from './systemRoutes'
import type { SystemDashboardProps, SystemSummary } from './client/types'
import { formatLoad } from './client/presentation'

export default function SystemDashboard({ id, token, systemTelemetry, dockerTelemetry: initialDockerTelemetry, vms, vmMetrics, section }: SystemDashboardProps) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const [selectedContainerId, setSelectedContainerId] = useState(() => normalizeDockerTelemetry(initialDockerTelemetry).containers[0]?.id || '')
    const [restartContainer, setRestartContainer] = useState<DockerContainer | null>(null)
    const [stopAllVmsOpen, setStopAllVmsOpen] = useState(false)
    const telemetry = useSystemTelemetry({ id, token, systemTelemetry, dockerTelemetry: initialDockerTelemetry, onError: setMessage })
    const containers = useMemo(() => telemetry.dockerTelemetry.containers.filter((container): container is DockerContainer =>
        Boolean(container) && !['exited', 'dead', 'removing'].includes((container.state || container.status || '').toLowerCase())), [telemetry.dockerTelemetry.containers])
    const selectedContainer = containers.find(container => container.id === selectedContainerId) || containers[0] || null
    const { logs, logsReason, logsLoading, loadContainerLogs } = useContainerLogs(id, token, selectedContainer?.name)
    const normalizedVms = Array.isArray(vms) ? vms.filter((vm): vm is VM => Boolean(vm)) : []
    const normalizedMetrics = Array.isArray(vmMetrics) ? vmMetrics.filter((metric): metric is VMMetrics => Boolean(metric)) : []
    const runningContainers = containers.filter(container => (container.state || container.status || '').toLowerCase().includes('running')).length
    const unavailableStats = containers.filter(container => !container.stats && typeof container.cpu !== 'number' && typeof container.memory !== 'number').length
    const runningVms = normalizedVms.filter(vm => (vm.status ?? '').toLowerCase() === 'running').length
    const stoppedVms = normalizedVms.filter(vm => (vm.status ?? '').toLowerCase() === 'stopped').length
    const unhealthyContainers = containers.filter(container => ['bad', 'warn'].includes(containerHealth(container).tone))
    const telemetryBlocked = Boolean(telemetry.dockerTelemetry.unavailable_reason || telemetry.systemUnavailableReason)
    const triage = getTriage(telemetryBlocked, unhealthyContainers.length, normalizedVms.length, runningContainers, containers.length, runningVms, stoppedVms, telemetry.dockerTelemetry.unavailable_reason || telemetry.systemUnavailableReason)
    const summary = useMemo<SystemSummary[]>(() => buildSummary({
        containers: containers.length, runningContainers, unavailableStats, systemSnapshot: telemetry.systemSnapshot,
        systemUnavailableReason: telemetry.systemUnavailableReason, vms: normalizedVms.length, runningVms, stoppedVms,
    }), [containers.length, normalizedVms.length, runningContainers, runningVms, stoppedVms, telemetry.systemSnapshot, telemetry.systemUnavailableReason, unavailableStats])

    function inspectContainer(container: DockerContainer) {
        setSelectedContainerId(container.id)
        if (window.matchMedia('(max-width: 1279px)').matches) {
            window.requestAnimationFrame(() => document.getElementById('system-container-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }
    }

    async function handleRestartContainer(container: DockerContainer) {
        setRestartContainer(null)
        setMessage(await restartDocker(container.id))
        await telemetry.refreshAll(selectedContainerId, setSelectedContainerId)
    }

    async function handleStopAll() {
        setStopAllVmsOpen(false)
        const cookieToken = getCookie('access_token')
        const cookieId = getCookie('id')
        if (!cookieToken || !cookieId) return router.push(systemExpiredSessionPath())
        const response = await stopAllVms(cookieToken, cookieId)
        setMessage(response.message)
    }

    async function copyContainer(container: DockerContainer) {
        try {
            await navigator.clipboard.writeText(container.name)
            setMessage(`Copied ${container.name}.`)
        } catch {
            setMessage('Clipboard access is unavailable in this browser context.')
        }
    }

    return <div className='relative grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4'>
        <SystemOverviewControls summary={summary} refreshing={telemetry.refreshing} autoRefresh={telemetry.autoRefresh}
            onRefresh={() => void telemetry.refreshAll(selectedContainerId, setSelectedContainerId)} onToggleAutoRefresh={() => telemetry.setAutoRefresh(value => !value)} />
        <div className='max-w-3xl'><ErrorNotice compact variant='info' message={message as string | null} /></div>
        <AppConfirmDialog open={Boolean(restartContainer)} title={restartContainer ? `Restart ${restartContainer.name}?` : 'Restart container?'}
            body='Active requests in this container may be interrupted.' confirmLabel='Restart' onCancel={() => setRestartContainer(null)}
            onConfirm={() => restartContainer ? void handleRestartContainer(restartContainer) : undefined} />
        <AppConfirmDialog open={stopAllVmsOpen} title='Stop all virtual machines?' body='This can interrupt active VM sessions.' confirmLabel='Stop VMs' tone='danger'
            onCancel={() => setStopAllVmsOpen(false)} onConfirm={() => void handleStopAll()} />
        {section === 'overview' ? <div id='system-telemetry' className='space-y-2'>
            {telemetry.dockerTelemetry.unavailable_reason && <TelemetryWarning source='Docker' reason={telemetry.dockerTelemetry.unavailable_reason} />}
            {telemetry.systemUnavailableReason && <TelemetryWarning source='Host' reason={telemetry.systemUnavailableReason} />}
        </div> : null}
        {section === 'virtual-machines' ? <SystemTriage runningContainers={runningContainers} containerCount={containers.length} runningVms={runningVms} {...triage} /> : null}
        {section === 'containers' ? <ContainersSection containers={containers} selectedContainer={selectedContainer}
            unavailableReason={telemetry.dockerTelemetry.unavailable_reason} logs={logs} logsReason={logsReason} logsLoading={logsLoading}
            onSelect={inspectContainer} onCopy={copyContainer} onRestart={setRestartContainer} onRefreshLogs={container => void loadContainerLogs(container)} /> : null}
        {section === 'virtual-machines' ? <VirtualMachinesSection vms={normalizedVms} metrics={normalizedMetrics} runningCount={runningVms}
            stoppedCount={stoppedVms} onStopAll={() => setStopAllVmsOpen(true)} /> : null}
    </div>
}

function getTriage(blocked: boolean, unhealthyCount: number, vmCount: number, runningContainers: number, containers: number, runningVms: number, stoppedVms: number, reason: string) {
    if (blocked) return { href: '/system#system-telemetry', title: 'Recover telemetry first', detail: reason || 'System telemetry is reconnecting.', actionLabel: 'Review telemetry' }
    if (unhealthyCount) return { href: '/system/containers#system-containers', title: 'Inspect container health', detail: `${unhealthyCount} container${unhealthyCount === 1 ? '' : 's'} need review before VM operations.`, actionLabel: 'Inspect containers' }
    if (vmCount) return { href: '/system/virtual-machines#system-vms', title: 'Review virtual machines', detail: `${runningVms} VMs running, ${stoppedVms} stopped, with ${runningContainers}/${containers || 0} containers active.`, actionLabel: 'Review VMs' }
    return { href: '/system/containers#system-containers', title: 'Wait for runtime inventory', detail: 'Container and VM inventory will appear when the live system streams respond.', actionLabel: 'Open containers' }
}

function buildSummary({ containers, runningContainers, unavailableStats, systemSnapshot, systemUnavailableReason, vms, runningVms, stoppedVms }: {
    containers: number; runningContainers: number; unavailableStats: number; systemSnapshot: SystemSnapshot | null
    systemUnavailableReason: string; vms: number; runningVms: number; stoppedVms: number
}): SystemSummary[] {
    const memoryPercent = systemSnapshot?.memory?.percent ? `${systemSnapshot.memory.percent}%` : 'Connecting'
    return [
        { label: 'Runtime', value: containers ? `${runningContainers}/${containers}` : '0', note: containers ? 'containers running' : 'container inventory checking', icon: <ServerCog className='h-4 w-4' />, tone: unavailableStats ? 'warn' : 'ok' },
        { label: 'CPU load', value: formatLoad(systemSnapshot?.load), note: '1 / 5 / 15 min', icon: <Cpu className='h-4 w-4' /> },
        { label: 'Memory', value: systemUnavailableReason ? 'Unavailable' : memoryPercent, note: systemSnapshot ? `${formatBytes(systemSnapshot.memory.used)} / ${formatBytes(systemSnapshot.memory.total)}` : systemUnavailableReason || 'host telemetry connecting', icon: <MemoryStick className='h-4 w-4' />, tone: systemUnavailableReason ? 'warn' : undefined },
        { label: 'VMs', value: String(vms), note: `${runningVms} running, ${stoppedVms} stopped`, icon: <HardDrive className='h-4 w-4' /> },
    ]
}
