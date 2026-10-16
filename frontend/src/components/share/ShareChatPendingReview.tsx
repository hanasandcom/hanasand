import { Check, FileText, Loader2 } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'
import { ChangeSummaryCard, ReviewEvidencePanel } from './ShareChatReview'
import type { BrowserEvidence, PendingEdit, RunSummary } from './shareChatTypes'

type Props = {
    pendingEdit: PendingEdit | null
    pendingEditBlocksNewRun: boolean
    browserEvidence: BrowserEvidence[]
    lastRun: RunSummary | null
    discardPendingEdit: () => void
    applyPendingEdit: () => Promise<void>
}

export function ShareChatPendingReview({ pendingEdit, pendingEditBlocksNewRun, browserEvidence, lastRun, discardPendingEdit, applyPendingEdit }: Props) {
    return (
        <>
            {pendingEdit ? (
                <div className='border-t border-ui-border bg-ui-canvas/14 p-3'>
                    <div className='mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                        <div className='min-w-0'>
                            <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text/86'>
                                <FileText className='h-4 w-4 text-ui-primary' />
                                <span className='rounded-full border border-ui-border px-2 py-0.5 text-[11px] font-medium text-ui-text/62'>
                                    Review
                                </span>
                                <span className='truncate'>What changed</span>
                                <span className='rounded-full border border-ui-border px-2 py-0.5 text-[11px] font-medium text-ui-text/48'>
                                    {pendingEdit.changes.length} pending change{pendingEdit.changes.length === 1 ? '' : 's'}
                                </span>
                                <span className='rounded-full border border-ui-border px-2 py-0.5 text-[11px] font-medium text-ui-text/48'>
                                    {pendingEdit.changes.length} file change{pendingEdit.changes.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            <p className='mt-1 text-xs leading-5 text-ui-text/48'>
                                Resolve the pending change before starting another assistant run.
                            </p>
                        </div>
                        <div className='flex shrink-0 items-center gap-1.5'>
                            {pendingEdit.status === 'pending' ? (
                                <button
                                    type='button'
                                    onClick={discardPendingEdit}
                                    className='inline-flex h-8 cursor-pointer items-center rounded-full border border-ui-border px-3 text-xs font-medium text-ui-text/52 transition hover:bg-ui-panel/8 hover:text-ui-text/72'
                                >
                                    Discard
                                </button>
                            ) : null}
                            {pendingEdit.status === 'applying' || pendingEdit.status === 'applied' ? (
                                <button
                                    type='button'
                                    disabled
                                    onClick={applyPendingEdit}
                                    className='inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ui-panel px-3 text-xs font-semibold text-background transition hover:bg-ui-panel/88 disabled:cursor-default disabled:opacity-55'
                                >
                                    {pendingEdit.status === 'applying' ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Check className='h-3.5 w-3.5' />}
                                    {pendingEdit.status === 'applied' ? 'Applied' : 'Applying'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                    {pendingEditBlocksNewRun ? (
                        <div className='mb-2 rounded-lg border border-ui-warning/10 bg-ui-warning/12 px-2 py-1.5 text-xs text-ui-warning/68'>
                            Apply or discard the pending change before asking for another edit.
                        </div>
                    ) : null}
                    <div className='max-h-72 space-y-2 overflow-auto'>
                        {pendingEdit.changes.map((change) => <ChangeSummaryCard key={change.id} change={change} />)}
                    </div>
                    <ReviewEvidencePanel evidence={browserEvidence[0] || null} lastRun={lastRun} />
                    {pendingEdit.error ? <ErrorNotice compact className='mt-2' message={pendingEdit.error} /> : null}
                </div>
            ) : null}
        </>
    )
}
