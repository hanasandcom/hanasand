import { Activity, Loader2 } from 'lucide-react'

export type RouteQueueAction = {
    id: string
    label: string
    state: string
    detail: string
    tone: 'ok' | 'warn' | 'bad' | 'neutral'
    command: string
    busy: boolean
    disabled: boolean
    disabledReason?: string
    onClick: () => void | Promise<void>
}

export function RouteQueueCard({ action }: { action: RouteQueueAction }) {
    const toneClass = action.tone === 'ok'
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : action.tone === 'warn'
            ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
            : action.tone === 'bad'
                ? 'border-ui-danger/30 bg-ui-raised/10 text-ui-text'
                : 'border-ui-border bg-ui-panel text-ui-muted'
    return (
        <article className='grid min-h-36 min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='min-w-0'>
                <div className='flex items-start justify-between gap-2'>
                    <h4 className='min-w-0 wrap-break-word text-sm font-semibold text-ui-text'>{action.label}</h4>
                    <span className={`max-w-[55%] shrink-0 truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`} title={action.state}>{action.state}</span>
                </div>
                <p className='mt-2 line-clamp-2 text-xs leading-5 text-ui-subtle'>{action.detail}</p>
                {action.disabled && action.disabledReason ? <p className='mt-2 rounded-md border border-ui-warning/30 bg-ui-warning/10 px-2 py-1 text-xs font-semibold leading-5 text-ui-warning' data-dwm-command-disabled-reason='true'>{action.disabledReason}</p> : null}
            </div>
            <button type='button' onClick={action.onClick} disabled={action.disabled} title={action.disabledReason} className='mt-auto inline-flex min-h-9 max-w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/30 disabled:cursor-not-allowed disabled:opacity-60'>
                {action.busy ? <Loader2 className='h-4 w-4 animate-spin' /> : <Activity className='h-4 w-4' />}
                {action.busy ? 'Running...' : action.command}
            </button>
        </article>
    )
}
