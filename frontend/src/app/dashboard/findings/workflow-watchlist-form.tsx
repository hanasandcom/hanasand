import { BellRing, RefreshCw, Send } from 'lucide-react'
import type { FormEvent, RefObject } from 'react'
import { WorkflowButton, WorkflowSubmitButton } from './workflow-controls'
import type { WorkflowResult } from './workflow-types'

export function WorkflowWatchlistForm({ terms, hasTerms, onTermsChange, inputRef, onSave, busy, saving, disabledReason, testDisabledReason, onCollect, collecting, onDeliver, delivering, onTest, testing, result, compact = false }: {
    terms: string
    hasTerms: boolean
    onTermsChange: (value: string) => void
    inputRef: RefObject<HTMLTextAreaElement | null>
    onSave: (event: FormEvent<HTMLFormElement>) => void
    busy: boolean
    saving: boolean
    disabledReason: string
    testDisabledReason?: string
    onCollect?: () => void
    collecting?: boolean
    onDeliver?: () => void
    delivering?: boolean
    onTest?: () => void
    testing?: boolean
    result?: WorkflowResult | null
    compact?: boolean
}) {
    if (compact) return <form onSubmit={onSave} className='grid gap-3'>
        <textarea ref={inputRef} aria-label='Watchlist terms' value={terms} onChange={event => onTermsChange(event.target.value)} placeholder='One term per line' className='min-h-24 w-full resize-y rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
        <div className='flex flex-wrap items-center gap-3'><WorkflowSubmitButton busy={saving} disabled={busy || Boolean(disabledReason)}>Save terms</WorkflowSubmitButton>{result ? <p role='status' className={`text-sm ${result.ok ? 'text-ui-success' : 'text-ui-danger'}`}>{result.message}</p> : null}</div>
    </form>

    return <form onSubmit={onSave} className='rounded-lg border border-ui-border bg-ui-raised p-4 shadow-sm'>
        <div className='flex items-start justify-between gap-3'><div><h2 className='text-base font-semibold text-ui-text'>Customer watchlist</h2><p className='mt-1 text-xs leading-5 text-ui-subtle'>Company, domain, vendor, brand, and product terms.</p></div><BellRing className='h-5 w-5 text-ui-primary' /></div>
        <textarea ref={inputRef} value={terms} onChange={event => onTermsChange(event.target.value)} placeholder='One customer-owned company, domain, supplier, brand, or product per line' className='mt-3 min-h-28 w-full resize-y rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
        <div className='mt-3 flex flex-wrap gap-2'><WorkflowSubmitButton busy={saving} disabled={busy || Boolean(disabledReason)} disabledReason={disabledReason} icon={<RefreshCw className='h-4 w-4' />}>Save and check events</WorkflowSubmitButton>
            {onCollect ? <WorkflowButton busy={Boolean(collecting)} disabled={busy} icon={<RefreshCw className='h-4 w-4' />} onClick={onCollect}>Run Telegram collection</WorkflowButton> : null}
            {onDeliver ? <WorkflowButton busy={Boolean(delivering)} disabled={busy} icon={<Send className='h-4 w-4' />} onClick={onDeliver}>Send webhooks</WorkflowButton> : null}
            {onTest ? <WorkflowButton busy={Boolean(testing)} disabled={busy || Boolean(testDisabledReason)} disabledReason={testDisabledReason} icon={<Send className='h-4 w-4' />} onClick={onTest}>Test webhook</WorkflowButton> : null}
        </div>
        {!hasTerms ? <p className='mt-2 text-xs leading-5 text-ui-warning'>No persisted watchlist terms. Add terms owned by this tenant before collecting or checking events.</p> : null}
        {testDisabledReason ? <p className='mt-1 text-xs leading-5 text-ui-subtle'>{testDisabledReason}</p> : null}
    </form>
}
