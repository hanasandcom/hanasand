import type { ReactNode } from 'react'
import { Activity, Loader2 } from 'lucide-react'

export function RouteStateCard({ label, value, detail, tone }: { label: string, value: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'ok' ? 'text-ui-success' : tone === 'warn' ? 'text-ui-warning' : tone === 'bad' ? 'text-ui-text' : 'text-ui-primary'
    return <div className='min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
        <div className='flex items-center justify-between gap-2 text-ui-subtle'>
            <p className='truncate text-[10px] font-semibold uppercase'>{label}</p>
            <Activity className='h-3.5 w-3.5 shrink-0' />
        </div>
        <p className={`mt-1 truncate text-base font-semibold ${toneClass}`}>{value}</p>
        <p className='truncate text-[11px] leading-4 text-ui-subtle'>{detail}</p>
    </div>
}

export function WorkflowButton({ busy, disabled, disabledReason, icon, onClick, children }: { busy: boolean, disabled: boolean, disabledReason?: string, icon: ReactNode, onClick: () => void, children: string }) {
    return <button type='button' onClick={onClick} disabled={disabled} title={disabledReason || undefined} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'>
        {busy ? <Loader2 className='h-4 w-4 animate-spin' /> : icon}
        {children}
    </button>
}
