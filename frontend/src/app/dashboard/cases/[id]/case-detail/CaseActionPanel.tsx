import { BellRing, Loader2 } from 'lucide-react'
import type { CaseAction, CaseDetail } from './contracts'
import { actionLabel, actionUnavailableReasons } from './model'
import { ActionButton } from './presentation'
import { date } from '../../caseDate'
import { requiresHumanReview } from '../../caseResolution'

export function CaseActionPanel({ detail, actions, readOnly, owner, setOwner, note, setNote, aiResolution, setAiResolution, busy, message, runAction, notifyCustomer }: {
    detail: CaseDetail
    actions: CaseAction[]
    readOnly: boolean
    owner: string
    setOwner: (owner: string) => void
    note: string
    setNote: (note: string) => void
    aiResolution: boolean
    setAiResolution: (enabled: boolean) => void
    busy: string | null
    message: { ok: boolean, text: string } | null
    runAction: (action: CaseAction) => void
    notifyCustomer: () => void
}) {
    const blockers = actionUnavailableReasons(actions, readOnly)
    const caseRecord = detail.case
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center justify-between gap-2'>
                <h2 className='text-sm font-semibold text-ui-text'>Analyst actions</h2>
                {readOnly ? <span className='rounded-full border border-ui-warning/30 bg-ui-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-ui-warning'>Read only</span> : null}
            </div>
            <label className='mt-3 block text-[10px] font-semibold uppercase text-ui-muted'>Owner</label>
            <input value={owner} onChange={event => setOwner(event.target.value)} placeholder='owner@company.com' className='mt-1 h-10 w-full rounded-lg border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary/35' />
            <label className='mt-3 block text-[10px] font-semibold uppercase text-ui-muted'>Reason</label>
            {caseRecord?.resolution ? <p className='mb-3 text-sm text-ui-muted'>{caseRecord.resolution.type === 'ai' ? 'AI resolved' : `Resolved by ${caseRecord.resolution.actor || 'unknown actor'}`} · {caseRecord.resolution.confirmedAt ? `Human confirmed by ${caseRecord.resolution.confirmedBy} at ${date(caseRecord.resolution.confirmedAt)}` : requiresHumanReview(caseRecord.resolution) ? 'Awaiting human confirmation' : 'Resolution recorded'}</p> : null}
            <label className='mb-2 flex items-center gap-2 text-sm'><input type='checkbox' checked={aiResolution} onChange={event => setAiResolution(event.target.checked)} />AI resolution (when closing) — requires human confirmation</label>
            <textarea value={note} onChange={event => setNote(event.target.value)} placeholder='Decision rationale, delivery context, or customer note.' className='mt-1 min-h-24 w-full resize-y rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm leading-6 text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary/35' />
            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                {actions.map(action => <ActionButton key={action.id} action={action} busy={busy === action.id} disabled={readOnly || busy !== null || !action.enabled} onClick={() => runAction(action)} />)}
            </div>
            {blockers.length ? <div className='mt-3 rounded-lg border border-ui-border bg-ui-canvas p-3' data-dwm-case-action-blockers='true'>
                <p className='text-[10px] font-semibold uppercase text-ui-muted'>Blocked actions</p>
                <ul className='mt-2 grid gap-1 text-xs leading-5 text-ui-muted'>
                    {blockers.slice(0, 4).map(item => <li key={item.id} className='flex min-w-0 gap-2'><span className='shrink-0 font-semibold text-ui-text'>{actionLabel(item.id)}:</span><span className='wrap-break-word'>{item.reason}</span></li>)}
                </ul>
            </div> : null}
            <button type='button' onClick={notifyCustomer} disabled={readOnly || busy !== null} className='mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-on-primary transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                {busy === 'notify' ? <Loader2 className='h-4 w-4 animate-spin' /> : <BellRing className='h-4 w-4' />}Notify dry run
            </button>
            {message ? <p className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${message.ok ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-danger/30 bg-ui-raised/10 text-ui-text'}`}>{message.text}</p> : null}
        </section>
    )
}
