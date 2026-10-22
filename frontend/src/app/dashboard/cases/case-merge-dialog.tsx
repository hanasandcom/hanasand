'use client'

import type { CaseRow } from './caseTypes'

type CaseMergeDialogProps = {
    open: boolean
    targetId: string
    rows: CaseRow[]
    selectedCount: number
    busy: boolean
    error: string
    onTargetChange: (value: string) => void
    onClose: () => void
    onSubmit: () => void
}

export function CaseMergeDialog({ open, targetId, rows, selectedCount, busy, error, onTargetChange, onClose, onSubmit }: CaseMergeDialogProps) {
    if (!open) return null
    return <div className='fixed inset-0 z-50 grid place-items-center bg-black/50 p-4' onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
        <section role='dialog' aria-modal='true' aria-labelledby='merge-cases-title' className='grid w-full max-w-lg gap-4 rounded-xl border border-ui-border bg-ui-panel p-5 shadow-xl'>
            <div><h2 id='merge-cases-title' className='text-lg font-semibold text-ui-text'>Merge monitoring cases</h2><p className='mt-2 text-sm text-ui-muted'>Events, comments, notification records, and original field values are retained on the selected case. The other case links will open it.</p></div>
            <label className='grid gap-1 text-sm text-ui-text'>Keep this case<select aria-label='Case to keep' value={targetId} onChange={event => onTargetChange(event.target.value)} className='rounded border border-ui-border bg-ui-canvas p-2'>{rows.map(row => <option key={row.caseId || row.id} value={row.caseId || row.id}>{row.title || row.id}</option>)}</select></label>
            {error && <p role='alert' className='text-sm text-ui-text'>{error}</p>}
            <div className='flex justify-end gap-2'><button type='button' className='rounded border border-ui-border px-3 py-2 text-sm' disabled={busy} onClick={onClose}>Cancel</button><button type='button' className='rounded bg-ui-primary px-3 py-2 text-sm text-white disabled:opacity-50' disabled={busy || !targetId} onClick={onSubmit}>{busy ? 'Merging…' : `Merge ${selectedCount - 1} into ${targetId || 'case'}`}</button></div>
        </section>
    </div>
}
