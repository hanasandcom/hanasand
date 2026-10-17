'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Cpu, Gauge, HardDrive, MemoryStick, MessageSquareText, Zap } from 'lucide-react'
import Button from '../misc/button'
import GPU from './gpu'
import Metric, { SensorMetric } from './metric'
import Lane from './displayClientLanes'
import operationalStateLabel from '@/utils/status/operationalStateLabel'

export default function DisplayClient({
    client,
    onTestClient,
}: {
    client: GPT_Client
    onTestClient: (client: GPT_Client) => void
}) {
    const [open, setOpen] = useState(false)

    const stats = {
        ram: averageMetric(client.ram.map(ram => ram.load)),
        cpu: averageMetric(client.cpu.map(cpu => cpu.load)),
        gpu: averageMetric(client.gpu.map(gpu => gpu.load)),
    }
    const lanes = client.lanes || []
    const laneCapacity = {
        active: lanes.reduce((sum, lane) => sum + lane.activeRequests, 0),
        max: lanes.reduce((sum, lane) => sum + lane.maxRequests, 0),
        available: lanes.reduce((sum, lane) => sum + lane.availableRequests, 0),
    }
    const sensorCount = client.ram.length + client.cpu.length + client.gpu.length
    const totalWatts = client.power?.totalWatts || 0
    const status = operationalState(client, laneCapacity.max, sensorCount)

    return (
        <div
            className='w-full rounded-xl bg-ui-canvas/35 p-4 text-left outline outline-ui-border transition-colors hover:bg-ui-canvas/50'
        >
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                    <div>
                        <h3 className='text-lg font-semibold text-ui-text/90'>{client.name}</h3>
                        <p className='text-sm text-ui-text/50'>
                            {sensorCount
                                ? `${client.ram.length} RAM, ${client.cpu.length} CPU, ${client.gpu.length} GPU sensors`
                                : lanes.length ? `${lanes.length} model lanes connected` : 'telemetry offline'}
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        {client.ram.length ? <Metric label='RAM' metric={stats.ram} /> : null}
                        {client.cpu.length ? <Metric label='CPU' metric={stats.cpu} /> : null}
                        {client.gpu.length ? <Metric label='GPU' metric={stats.gpu} /> : null}
                        {client.model.tps > 0 || laneCapacity.max > 0 ? (
                            <StatPill label='TPS' value={`${client.model.tps.toFixed(1)}`} icon={<Gauge className='h-3.5 w-3.5' />} />
                        ) : null}
                        {laneCapacity.max > 0 ? (
                            <StatPill label='Lanes' value={`${laneCapacity.available}/${laneCapacity.max}`} icon={<HardDrive className='h-3.5 w-3.5' />} />
                        ) : null}
                        {totalWatts > 0 ? (
                            <StatPill label='Power' value={`${totalWatts.toFixed(0)} W`} icon={<Zap className='h-3.5 w-3.5' />} />
                        ) : null}
                        <button
                            type='button'
                            onClick={() => setOpen(prev => !prev)}
                            className='flex h-9 w-9 items-center justify-center rounded-full bg-ui-primary/12 text-ui-primary outline outline-ui-primary/20'
                        >
                            {open ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                        </button>
                    </div>
                </div>
                <div className='grid gap-3 border-t border-ui-border pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
                    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                        <ModelStat title='Current tokens' value={client.model.currentTokens.toString()} />
                        <ModelStat title='Active requests' value={`${laneCapacity.active}/${laneCapacity.max}`} />
                        <ModelStat
                            title='Context'
                            value={`${client.model.contextTokens}/${lanes[0]?.contextMaxTokens || client.model.contextMaxTokens || 0}`}
                        />
                        <ModelStat title='Status' value={status.label} highlight={status.tone} />
                    </div>
                    <div className='flex justify-start md:justify-end'>
                        <Button
                            text='Test client'
                            icon={<MessageSquareText className='h-4 w-4' />}
                            onClick={() => onTestClient(client)}
                        />
                    </div>
                </div>
                {open ? <DisplayClientDetails client={client} /> : null}
            </div>
        </div>
    )
}

export function DisplayClientDetails({ client }: { client: GPT_Client }) {
    return (
        <div className='space-y-4 border-t border-ui-border pt-4'>
            {(client.lanes || []).length ? (
                <MetricSection
                    title='Inference lanes'
                    icon={<Gauge className='h-4 w-4' />}
                    items={(client.lanes || []).map((lane) => <Lane key={lane.id} lane={lane} />)}
                />
            ) : null}
            <div className='grid gap-4 lg:grid-cols-3'>
                <MetricSection
                    title='RAM'
                    icon={<MemoryStick className='h-4 w-4' />}
                    items={client.ram.map((ram, id) => <SensorMetric key={`${ram.name}-${id}`} name={ram.name} load={ram.load} />)}
                />
                <MetricSection
                    title='CPU'
                    icon={<Cpu className='h-4 w-4' />}
                    items={client.cpu.map((cpu, id) => <SensorMetric key={`${cpu.name}-${id}`} name={cpu.name} load={cpu.load} />)}
                />
                <MetricSection
                    title='GPU'
                    icon={<HardDrive className='h-4 w-4' />}
                    items={client.gpu.map((gpu, id) => <GPU key={`${gpu.name}-${id}`} gpu={gpu} />)}
                />
            </div>
        </div>
    )
}

function MetricSection({ title, icon, items }: { title: string, icon: ReactNode, items: ReactNode[] }) {
    return (
        <div className='rounded-xl bg-ui-canvas/25 p-4 outline outline-ui-border'>
            <div className='mb-3 flex items-center gap-2 text-ui-text/35'>
                {icon}
                <h4 className='text-sm font-semibold uppercase tracking-[0.18em]'>{title}</h4>
            </div>
            <div className='space-y-2'>
                {items.length ? items : <p className='text-sm text-ui-text/45'>No metrics reported.</p>}
            </div>
        </div>
    )
}

function StatPill({ label, value, icon }: { label: string, value: string, icon: ReactNode }) {
    return (
        <span
            className='inline-flex items-center gap-2 rounded-full bg-ui-primary/12 px-3 py-1 text-sm font-semibold text-ui-on-primary/90 outline outline-ui-primary/20'
        >
            {icon}
            <span className='text-[10px] uppercase tracking-[0.18em] text-ui-text/35'>{label}</span>
            <span>{value}</span>
        </span>
    )
}

function ModelStat({ title, value, highlight }: { title: string, value: string, highlight?: string }) {
    const highlightClass = highlight === 'error'
        ? 'text-ui-text'
        : highlight === 'generating'
            ? 'text-ui-success'
            : highlight === 'preparing'
                ? 'text-ui-warning'
                : 'text-ui-text/90'

    return (
        <div className='rounded-xl bg-ui-canvas/20 px-3 py-2 outline outline-ui-border'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-ui-text/35'>{title}</div>
            <div className={`mt-1 text-sm font-semibold ${highlightClass}`}>{value}</div>
        </div>
    )
}

function operationalState(client: GPT_Client, laneMax: number, sensorCount: number) {
    if (!sensorCount && !laneMax) return { label: 'no telemetry', tone: 'preparing' }
    if (!sensorCount && laneMax) return { label: 'connected', tone: 'idle' }
    if (client.model.status === 'error' && laneMax > 0) return { label: 'ready', tone: 'idle' }
    return { label: operationalStateLabel(client.model.status), tone: client.model.status }
}

function averageMetric(values: number[]) {
    if (!values.length) {
        return 0
    }

    return Math.ceil(values.reduce((sum, value) => sum + value, 0) / values.length * 100)
}
