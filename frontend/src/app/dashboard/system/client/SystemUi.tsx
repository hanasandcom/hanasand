import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { containerHealth, type MetricState } from '../systemPresentation'
import { portLabel } from './presentation'
import type { SystemSummary } from './types'

export function SummaryCard({ item }: { item: SystemSummary }) {
    const tone = item.tone === 'bad' ? 'text-ui-text' : item.tone === 'warn' ? 'text-ui-warning' : item.tone === 'ok' ? 'text-ui-success' : 'text-ui-primary'
    return <DashboardPanel className='p-4'>
        <div className='flex items-center justify-between gap-3 text-ui-muted'>
            <span className='text-sm font-semibold'>{item.label}</span>
            <span className={tone}>{item.icon}</span>
        </div>
        <p className='mt-3 text-2xl font-semibold text-ui-text'>{item.value}</p>
        <p className='mt-1 text-xs font-medium text-ui-muted'>{item.note}</p>
    </DashboardPanel>
}

export function MetricText({ metric }: { metric: MetricState }) {
    return <span className={metric.unavailable ? 'text-ui-warning' : 'text-ui-text'} title={metric.reason || metric.value}>{metric.value}</span>
}

export function PortList({ ports, className = '' }: { ports?: DockerContainerPort[], className?: string }) {
    const value = portLabel(ports)
    return <div className={`max-w-64 overflow-x-auto whitespace-nowrap [scrollbar-width:thin] ${className}`} title={value}>{value}</div>
}

export function Fact({ label, value, reason }: { label: string, value: string, reason?: string }) {
    return <div className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
        <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text'>{value}</p>
        {reason && <p className='mt-1 text-xs text-ui-warning'>{reason}</p>}
    </div>
}

export function HealthPill({ health }: { health: ReturnType<typeof containerHealth> }) {
    const tone = health.tone === 'ok' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : health.tone === 'warn' ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : health.tone === 'bad' ? 'border-ui-danger/35 bg-ui-raised/10 text-ui-text' : 'border-ui-border bg-ui-raised text-ui-text'
    const Icon = health.tone === 'ok' ? CheckCircle2 : health.tone === 'bad' ? AlertTriangle : Clock3
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
        <Icon className='h-3.5 w-3.5' />{health.label}
    </span>
}

export function IconButton({ label, onClick, children }: { label: string, onClick: () => void, children: ReactNode }) {
    return <button type='button' onClick={onClick} aria-label={label} title={label} className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-raised hover:text-ui-primary'>
        {children}
    </button>
}

export function LinkButton({ href, icon, label }: { href: string, icon: ReactNode, label: string }) {
    return <Link href={href} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-raised hover:text-ui-primary'>
        {icon}{label}
    </Link>
}

export function EmptyState({ title, body }: { title: string, body: string }) {
    return <div className='rounded-md border border-dashed border-ui-border bg-ui-raised px-4 py-6 text-sm text-ui-muted'>
        <p className='font-semibold text-ui-text'>{title}</p><p className='mt-1'>{body}</p>
    </div>
}
