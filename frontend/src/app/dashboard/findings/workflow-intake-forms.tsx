import { Plus, Send, ShieldCheck } from 'lucide-react'
import type { FormEvent } from 'react'
import { WorkflowButton, WorkflowSubmitButton } from './workflow-controls'

export function PublicEvidenceForm({ actor, onActor, company, onCompany, data, onData, url, onUrl, busy, saving, disabledReason, onSubmit, onOpenCase, openingCase }: {
    actor: string, onActor: (value: string) => void
    company: string, onCompany: (value: string) => void
    data: string, onData: (value: string) => void
    url: string, onUrl: (value: string) => void
    busy: boolean, saving: boolean, disabledReason: string
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
    onOpenCase: () => void, openingCase: boolean
}) {
    return <form onSubmit={onSubmit} className='rounded-lg border border-ui-border bg-ui-raised p-4 shadow-sm'>
        <div className='flex items-start justify-between gap-3'><div><h2 className='text-base font-semibold text-ui-text'>Public incident evidence</h2><p className='mt-1 text-sm leading-6 text-ui-subtle'>Fetch a public incident report, retain its publisher timestamp, and create cases for matching events.</p></div><ShieldCheck className='h-5 w-5 text-ui-primary' /></div>
        <input value={actor} onChange={event => onActor(event.target.value)} placeholder='Publisher or reporting actor' className='mt-4 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
        <input value={company} onChange={event => onCompany(event.target.value)} placeholder='Affected organization or domain' className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
        <textarea value={data} onChange={event => onData(event.target.value)} placeholder='What happened?' className='mt-3 min-h-20 w-full resize-y rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
        <input value={url} onChange={event => onUrl(event.target.value)} placeholder='HTTPS source URL' className='mt-3 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
        <div className='mt-3 flex flex-wrap gap-2'><WorkflowSubmitButton busy={saving} disabled={busy || Boolean(disabledReason)} disabledReason={disabledReason} icon={<Plus className='h-4 w-4' />}>Fetch and rebuild</WorkflowSubmitButton>
            <WorkflowButton busy={openingCase} disabled={busy || Boolean(disabledReason)} disabledReason={disabledReason || undefined} icon={<ShieldCheck className='h-4 w-4' />} onClick={onOpenCase}>Open case</WorkflowButton></div>
        {disabledReason ? <p className='mt-2 text-xs leading-5 text-ui-subtle'>{disabledReason}</p> : null}
    </form>
}

export function TelegramSourceForm({ target, onTarget, busy, disabledReason, onSubmit }: { target: string, onTarget: (value: string) => void, busy: boolean, disabledReason: string, onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
    return <form onSubmit={onSubmit} className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 shadow-sm'>
        <h2 className='text-base font-semibold text-ui-text'>Telegram source request</h2><p id='telegram-source-help' className='text-xs text-ui-subtle'>Public channels only.</p>
        <div className='flex flex-col gap-2 sm:flex-row'><input aria-label='Telegram channel' aria-describedby='telegram-source-help' value={target} onChange={event => onTarget(event.target.value)} placeholder='@channel or https://t.me/channel' className='h-10 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20' />
            <WorkflowSubmitButton busy={busy} disabled={busy || Boolean(disabledReason)} disabledReason={disabledReason} icon={<Send className='h-4 w-4' />} layout='telegram'>Submit source</WorkflowSubmitButton></div>
    </form>
}
