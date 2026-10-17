import type { RowMessage, ScopedCase } from '../types/activity'
import { inputClass, dangerConfirmButtonClass, iconDangerButtonClass } from '../constants/styles'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { organizationRoleLabel, organizationMonitoringCaseId, organizationLoadErrorLabel } from '../model/labels'
import type { OrganizationRole, OrganizationLoadError } from '../types/organization'
import { useState, type ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import Link from 'next/link'

export function SectionTitle({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
    return (
        <div className='flex items-start justify-between gap-4'>
            <div>
                <h2 className='flex items-center gap-2 text-base font-semibold text-ui-text dark:text-ui-text'>{icon}{title}</h2>
                {detail && <p className='mt-1 text-sm leading-5 text-ui-muted dark:text-ui-muted'>{detail}</p>}
            </div>
        </div>
    )
}

export function DisclosureSummary({ icon, title, detail, accessory }: { icon: ReactNode, title: string, detail: string, accessory: ReactNode }) {
    return (
        <summary className='flex cursor-pointer list-none flex-col gap-3 p-4 outline-none transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 dark:hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
            <SectionTitle icon={icon} title={title} detail={detail} />
            {accessory}
        </summary>
    )
}

export function Field({ label, value, onChange, disabled, placeholder = '', type = 'text' }: { label: string, value: string, onChange: (value: string) => void, disabled?: boolean, placeholder?: string, type?: string }) {
    return (
        <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
            {label}
            <input type={type} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass} placeholder={placeholder} />
        </label>
    )
}

export function SelectField({ label, value, options, onChange, disabled }: { label: string, value: string, options: string[], onChange: (value: string) => void, disabled?: boolean }) {
    return (
        <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>
            {label}
            <select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass}>
                {options.map(option => <option key={option} value={option}>{['Role', 'Invite role'].includes(label) ? organizationRoleLabel(option) : option.replaceAll('_', ' ')}</option>)}
            </select>
        </label>
    )
}

export function RoleBadge({ role, compact = false }: { role: OrganizationRole, compact?: boolean }) {
    return <span className={`shrink-0 rounded-md bg-ui-primary/10 font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary ${compact ? 'inline-flex whitespace-nowrap px-1.5 text-[10px] leading-4 align-middle' : 'px-2 py-1 text-xs'}`}>{organizationRoleLabel(role)}</span>
}

export function OrganizationMetadataBadge({ children, className = '' }: { children: ReactNode, className?: string }) {
    return <span className={`rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted ${className}`.trim()}>{children}</span>
}

export function StatusPill({ status }: { status: string }) {
    const normalized = status.toLowerCase()
    const tone = normalized === 'active' || normalized === 'delivered' || normalized === 'dry_run'
        ? 'bg-ui-success/15 text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : normalized === 'paused' || normalized.includes('retry') || normalized === 'skipped'
            ? 'bg-ui-warning/10 text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning'
            : normalized === 'failed' || normalized.includes('failed') || normalized === 'disabled'
                ? 'bg-ui-raised/10 text-ui-text dark:bg-ui-raised/10 dark:text-ui-text'
                : 'bg-ui-raised text-ui-muted dark:bg-ui-raised dark:text-ui-muted'
    return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{status}</span>
}

export function OrganizationLoadErrorBanner({ error, cases, organizationId }: { error: OrganizationLoadError, cases: ScopedCase[], organizationId?: string }) {
    const caseId = error.serviceUnavailable ? organizationMonitoringCaseId(cases) : undefined
    const caseHref = caseId && organizationId
        ? `/cases/${encodeURIComponent(caseId)}?organizationId=${encodeURIComponent(organizationId)}`
        : undefined
    const text = error.serviceUnavailable
        ? 'Organization service is temporarily unavailable.'
        : `${organizationLoadErrorLabel(error.endpoint)}: ${error.message}`
    return <StatusBanner tone='warning' text={text} leadingLink={caseHref && caseId ? { label: caseId, href: caseHref } : undefined} />
}

export function StatusBanner({ tone, text, leadingLink }: { tone: 'error' | 'warning' | 'success', text: string, leadingLink?: { label: string, href: string } }) {
    const classes = tone === 'error'
        ? 'border-ui-danger/35 bg-ui-raised/10 text-ui-text dark:border-ui-danger/35 dark:bg-ui-raised/10 dark:text-ui-text'
        : tone === 'warning'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
            : 'border-ui-success/35 bg-ui-success/10 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    const Icon = tone === 'success' ? CheckCircle2 : CircleAlert
    return (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${classes}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
            <Icon className='mt-0.5 h-4 w-4 shrink-0' />
            <span>{leadingLink && <><Link className='font-semibold underline underline-offset-2' href={leadingLink.href}>{leadingLink.label}</Link>: </>}{sanitizeOrganizationDisplayCopy(text) || text}</span>
        </div>
    )
}

export function RowStatus({ message }: { message?: RowMessage }) {
    if (!message) return null
    const tone = message.ok
        ? 'bg-ui-success/10 text-ui-success dark:bg-ui-success/10 dark:text-ui-success'
        : 'bg-ui-raised/10 text-ui-text dark:bg-ui-raised/10 dark:text-ui-text'
    return <span className={`inline-flex max-w-full truncate rounded-md px-2 py-1 text-[11px] font-semibold ${tone}`} role={message.ok ? 'status' : 'alert'} aria-live={message.ok ? 'polite' : 'assertive'}>{sanitizeOrganizationDisplayCopy(message.text) || message.text}</span>
}

export function InlineBusy({ label, marker }: { label: string, marker: string }) {
    return (
        <div className='mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted' role='status' aria-live='polite' {...{ [marker]: 'true' }}>
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
            {label}
        </div>
    )
}

export function ConfirmActionButton({ ariaLabel, title, disabled, onConfirm, icon }: { ariaLabel: string, title?: string, disabled?: boolean, onConfirm: () => void, icon: ReactNode }) {
    const [confirming, setConfirming] = useState(false)
    return (
        <button
            type='button'
            className={confirming ? dangerConfirmButtonClass : iconDangerButtonClass}
            disabled={disabled}
            aria-label={confirming ? `Confirm ${ariaLabel.toLowerCase()}` : ariaLabel}
            aria-pressed={confirming}
            title={confirming ? 'Press again to confirm, or Escape to cancel.' : title || ariaLabel}
            data-org-confirm-action={confirming ? 'confirming' : 'idle'}
            onBlur={() => setConfirming(false)}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.stopPropagation()
                    setConfirming(false)
                }
                if (event.key === 'Enter' || event.key === ' ') {
                    event.stopPropagation()
                }
            }}
            onClick={event => {
                event.stopPropagation()
                if (confirming) {
                    setConfirming(false)
                    onConfirm()
                    return
                }
                setConfirming(true)
            }}
        >
            {confirming ? <CheckCircle2 className='h-4 w-4' /> : icon}
            {confirming && <span>Confirm</span>}
        </button>
    )
}

export function EmptyLine({ text }: { text: string }) {
    return <p className='rounded-md bg-ui-raised px-3 py-2 text-sm text-ui-muted dark:bg-ui-canvas dark:text-ui-muted'>{text}</p>
}

export function SkeletonRows({ count }: { count: number }) {
    return Array.from({ length: count }, (_, index) => <div key={index} className='h-14 animate-pulse rounded-lg bg-ui-raised dark:bg-ui-raised' />)
}
