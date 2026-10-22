import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'
import { formatOsloShortDateTime } from '@/utils/date/formatOsloShortDateTime'

export type StatusTone = 'neutral' | 'ok' | 'watch' | 'bad'

export const workerStatusTone = (state: string): StatusTone => state === 'active' ? 'ok' : state === 'unavailable' ? 'bad' : 'watch'

export function StatusPill({ label, tone, compact = false, variant = 'default', className = '' }: {
    label: string
    tone: StatusTone
    compact?: boolean
    variant?: 'default' | 'activity'
    className?: string
}) {
    const classes = toneClass(tone)
    const sizeClass = variant === 'activity'
        ? 'rounded-full px-2 py-1 text-xs font-semibold'
        : compact
            ? `rounded-full border px-2 py-0.5 text-xs font-semibold ${classes.compactBg}`
            : `whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classes.bg}`
    return (
        <span className={`${sizeClass} ${variant === 'activity' ? classes.activityBg : classes.text} ${className}`.trim()}>
            {label}
        </span>
    )
}

export function Metric({ title, value, icon, tone = 'neutral', valueSize = 'default' }: {
    title: string
    value: string
    icon: ReactNode
    tone?: StatusTone
    valueSize?: 'default' | 'large'
}) {
    const valueClass = valueSize === 'large'
        ? 'mt-3 text-2xl font-semibold text-ui-text'
        : 'mt-3 text-xl font-semibold capitalize text-ui-text'
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className={valueClass}>{value}</p>
        </DashboardPanel>
    )
}

export function LiveLane({ title, href, icon, state, stateTone, primary, secondary, footer }: {
    title: string
    href: string
    icon: ReactNode
    state: string
    stateTone: StatusTone
    primary: string
    secondary: string
    footer: string
}) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'>
                    <span className='text-ui-primary'>{icon}</span>
                    <span className='truncate'>{title}</span>
                </div>
                <StatusPill label={state} tone={stateTone} />
            </div>
            <div className='grid gap-3 p-4'>
                <div>
                    <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{primary}</p>
                    <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{secondary}</p>
                </div>
                <div className='flex items-center justify-between gap-3'>
                    <span className='truncate text-xs text-ui-muted'>{footer}</span>
                    <Link
                        href={href}
                        className='inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'
                    >
                        Open
                        <ArrowRight className='h-3.5 w-3.5' />
                    </Link>
                </div>
            </div>
        </DashboardPanel>
    )
}

export function PanelTitle({ title, actionHref, actionLabel }: { title: string, actionHref: string, actionLabel: string }) {
    return (
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
            <h2 className='text-base font-semibold text-ui-text'>{title}</h2>
            <Link
                href={actionHref}
                className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-raised'
            >
                {actionLabel}
                <ExternalLink className='h-3.5 w-3.5' />
            </Link>
        </div>
    )
}

export function toneClass(tone: StatusTone) {
    if (tone === 'ok') return { bg: 'bg-ui-success/10 border border-ui-success/35', compactBg: 'border-ui-success/35 bg-ui-success/10', activityBg: 'border border-ui-success bg-ui-raised text-ui-success', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/10 border border-ui-warning/35', compactBg: 'border-ui-warning/35 bg-ui-warning/10', activityBg: 'border border-ui-warning bg-ui-raised text-ui-warning', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-raised/10 border border-ui-danger/35', compactBg: 'border-ui-danger/35 bg-ui-raised/10', activityBg: 'border border-ui-danger bg-ui-raised text-ui-text', text: 'text-ui-text' }
    return { bg: 'bg-ui-panel border border-ui-border', compactBg: 'border-ui-border bg-ui-panel', activityBg: 'border border-ui-primary bg-ui-raised text-ui-primary', text: 'text-ui-primary' }
}

export function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
}

export function shortTime(value: string) {
    return formatOsloShortDateTime(value)
}

export function sameKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
