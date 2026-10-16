import { CheckCircle2, Loader2, RotateCcw, ShieldCheck, UserRound, XCircle } from 'lucide-react'
import Link from '@/components/organizations/workspaceLink'
import type { ReactNode } from 'react'
import type { CaseAction } from './contracts'
import type { EvidenceRow, TimelineRow } from './evidenceTypes'
import { relativeTime, safeCaseEvidenceExcerpt, sourceReferenceState, stateLabel, evidenceReferenceState, evidenceHashState, timelineActorLabel, actionLabel } from './model'

export function Metric({ label, value, detail }: { label: string, value: string, detail: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 text-xl font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 truncate text-xs text-ui-muted' title={detail}>{detail}</p>
        </div>
    )
}

export function EvidenceMobileRow({ row, selected, onToggle }: { row: EvidenceRow, selected: boolean, onToggle: () => void }) {
    return (
        <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 text-xs' data-dwm-case-evidence-mobile-row='true'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='flex min-w-0 gap-2'>
                    <input type='checkbox' aria-label={`Select ${row.sourceName || row.id || 'evidence'} for third-party report`} checked={selected} disabled={!row.id} onChange={onToggle} />
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-ui-text'>{row.sourceName || sourceReferenceState(row)}</p>
                        <p className='mt-1 truncate text-ui-muted'>{stateLabel(row.sourceFamily)}</p>
                    </div>
                </div>
                <span className='shrink-0 rounded-md border border-ui-border bg-ui-canvas px-2 py-1 font-semibold text-ui-muted'>{relativeTime(row.observedAt || row.collectedAt)}</span>
            </div>
            <p className='wrap-break-word rounded-md bg-ui-canvas px-3 py-2 leading-5 text-ui-text'>{safeCaseEvidenceExcerpt(row)}</p>
            <div className='grid gap-1 text-[11px] font-semibold text-ui-muted'>
                <span className='truncate'>Capture: {evidenceReferenceState(row)}</span>
                <span className='truncate'>Hash: {evidenceHashState(row)}</span>
            </div>
        </article>
    )
}

export function TimelineItem({ row, compact = false }: { row: TimelineRow, compact?: boolean }) {
    const when = row.timestamp || row.at
    if (compact) {
        return (
            <div className='rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs'>
                <div className='flex items-start justify-between gap-3'>
                    <p className='font-semibold text-ui-text'>{stateLabel(row.action || row.eventType)}</p>
                    <p className='shrink-0 text-ui-muted'>{relativeTime(when)}</p>
                </div>
                <p className='mt-1 wrap-break-word leading-5 text-ui-muted'>{row.rationale || row.note || row.source || 'Case event recorded.'}</p>
                <p className='mt-2 text-[11px] font-semibold text-ui-muted'>{timelineActorLabel(row.actor)}{row.workflow?.toStatus ? ` · ${stateLabel(row.workflow.toStatus)}` : ''}</p>
            </div>
        )
    }
    return (
        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-canvas p-3 text-xs md:grid-cols-[160px_minmax(0,1fr)_180px]'>
            <div className='text-ui-muted'>{relativeTime(when)}</div>
            <div className='min-w-0'>
                <p className='font-semibold text-ui-text'>{stateLabel(row.action || row.eventType)}</p>
                <p className='mt-1 wrap-break-word leading-5 text-ui-muted'>{row.rationale || row.note || row.source || 'Case event recorded.'}</p>
            </div>
            <div className='text-[11px] font-semibold text-ui-muted'>{timelineActorLabel(row.actor)}{row.workflow?.toStatus ? <p>{stateLabel(row.workflow.toStatus)}</p> : null}</div>
        </div>
    )
}

export function ActionButton({ action, busy, disabled, onClick }: { action: CaseAction, busy: boolean, disabled: boolean, onClick: () => void }) {
    const Icon = busy ? Loader2 : action.id === 'reopen' ? RotateCcw : action.id === 'close' ? CheckCircle2 : action.id.includes('false') || action.id === 'suppress' ? XCircle : action.id === 'assign' ? UserRound : ShieldCheck
    return (
        <button type='button' onClick={onClick} disabled={disabled} title={action.disabledReason} className='inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-canvas px-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-50'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{actionLabel(action.id)}
        </button>
    )
}

export function CasePill({ label, value, tone }: { label: string, value: string, tone: 'ready' | 'warn' | 'neutral' }) {
    const toneClass = tone === 'ready' ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : tone === 'warn' ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning' : 'border-ui-border bg-ui-panel text-ui-text'
    return <div className={`rounded-lg border px-3 py-2 ${toneClass}`}><p className='text-[10px] font-semibold uppercase opacity-80'>{label}</p><p className='text-sm font-semibold'>{stateLabel(value)}</p></div>
}

export function KeyValue({ label, value }: { label: string, value: string }) {
    return <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-canvas p-2'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p><p className='wrap-break-word text-xs text-ui-text'>{value}</p></div>
}

export function EmptyLine({ text }: { text: string }) {
    return <div className='rounded-lg border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>{text}</div>
}

export function CommandLink({ href, children }: { href: string, children: ReactNode }) {
    const className = 'inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-canvas px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20'
    if (href.startsWith('/api/')) return <a href={href} className={className}>{children}</a>
    return <Link href={href} className={className}>{children}</Link>
}

export function CollapsiblePanel({ title, action, children, defaultOpen = false }: { title: string, action?: string, children: React.ReactNode, defaultOpen?: boolean }) {
    return (
        <details className='group rounded-lg border border-ui-border bg-ui-panel' open={defaultOpen}>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden'>
                <div className='min-w-0'>
                    <h2 className='text-sm font-semibold text-ui-text'>{title}</h2>
                    <p className='mt-1 text-xs text-ui-muted group-open:hidden'>Expand to inspect the attached rows.</p>
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                    {action ? <span className='rounded-full border border-ui-border bg-ui-canvas px-2 py-0.5 text-[10px] font-semibold uppercase text-ui-primary'>{action}</span> : null}
                    <span className='grid h-7 w-7 place-items-center rounded-lg border border-ui-border bg-ui-canvas text-xs font-semibold text-ui-muted group-open:rotate-45'>+</span>
                </div>
            </summary>
            <div className='border-t border-ui-border p-3'>{children}</div>
        </details>
    )
}
