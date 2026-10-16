import { ArrowUp, LoaderCircle } from 'lucide-react'

export function ChatComposer({ value, blockedReason, awaitingResponse, readOnly, onChange, onSend }: {
    value: string
    blockedReason: string | null
    awaitingResponse: boolean
    readOnly: boolean
    onChange: (value: string) => void
    onSend: () => void
}) {
    return <div className='relative z-10 border-t border-ui-border bg-ui-panel px-4 py-4 md:px-12 xl:px-24'>
        <div className='mx-auto flex min-h-14 max-w-5xl items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 shadow-sm focus-within:border-ui-primary focus-within:ring-4 focus-within:ring-ui-primary/15'>
            <textarea value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() }
            }} placeholder='Ask Hanasand to inspect context, draft a change, review files, or prepare customer notes...' readOnly={readOnly} rows={1} className='h-10 min-h-0 flex-1 resize-none overflow-hidden bg-transparent py-2 text-sm leading-6 text-ui-text outline-none placeholder:text-ui-muted' />
            <button type='button' aria-label='Send' aria-describedby={blockedReason ? 'ai-composer-blocked-reason' : undefined} title={blockedReason || undefined} disabled={Boolean(blockedReason) || !value.trim()} onClick={onSend} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ui-text text-ui-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'>
                {awaitingResponse ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <ArrowUp className='h-3.5 w-3.5 stroke-[2.8]' />}
            </button>
        </div>
        {blockedReason ? <div id='ai-composer-blocked-reason' className='mx-auto mt-2 max-w-5xl px-4 text-xs text-ui-muted'>{blockedReason}</div> : null}
    </div>
}
