import { Info } from 'lucide-react'
import type { ThesisDocument } from '@/utils/thesis'
import SheetEditor from './sheetEditor'
import TimetableSheet from './timetableSheet'
import PlanSheet from './planSheet'
import type { HistoryItem } from './useThesisHistory'
import type { Sheet } from './workspace'
import { identifiedSheets, sheetChanges } from './workspace'

type Props = {
    history: HistoryItem[]
    preview: ThesisDocument | null
    historyError: string
    historyHelp: boolean
    busy: boolean
    conflict: boolean
    more: boolean
    sheets: Sheet[]
    onToggleHelp: () => void
    onShowVersion: (revision: number) => void
    onRestore: (revision: number) => void
    onLoadMore: () => void
}

function ReadOnlySheet({ sheet }: { sheet: Sheet }) {
    const Component = sheet.id === 'Timetable' || sheet.name?.toLowerCase() === 'timetable'
        ? TimetableSheet
        : sheet.id === 'Plan' || sheet.name?.toLowerCase() === 'plan' ? PlanSheet : SheetEditor
    return <Component sheet={sheet} canEdit={false} onChange={() => {}} />
}

export default function VersionHistoryPanel({ history, preview, historyError, historyHelp, busy, conflict, more, sheets, onToggleHelp, onShowVersion, onRestore, onLoadMore }: Props) {
    return <>
        <section aria-label='Version history' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'>
                <h2 className='font-semibold'>Previous version</h2>
                <button type='button' aria-label='About version history' aria-expanded={historyHelp} aria-controls='thesis-history-help' onClick={onToggleHelp} className='grid min-h-11 min-w-11 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised'><Info size={18} /></button>
            </div>
            {historyHelp && <div id='thesis-history-help' className='rounded-lg border border-ui-border bg-ui-raised p-3 text-sm leading-6 text-ui-muted'>A checkpoint is saved every 20 minutes for 7 days. After that, up to 3 checkpoints are kept per day.</div>}
            {history.length === 0 && <p>No earlier versions yet.</p>}
            <ul className='grid gap-2'>
                {history.map(item => <li key={item.revision} className='group rounded-lg border border-ui-border'>
                    <div className='flex items-center gap-2 px-3 py-2'>
                        <button type='button' disabled={busy} aria-expanded={preview?.revision === item.revision} aria-controls={`thesis-version-${item.revision}`} onClick={() => onShowVersion(item.revision)} className='min-w-0 flex-1 rounded-sm py-1 text-left focus-visible:outline-2 focus-visible:outline-ui-primary'>
                            {item.immediate ? 'Previous version' : item.title} — {new Date(item.saved_at).toLocaleString()}
                        </button>
                        <button type='button' aria-label={`Restore version ${item.revision}`} disabled={busy || conflict} onClick={() => onRestore(item.revision)} className='shrink-0 rounded-md px-2 py-1 text-sm text-ui-muted transition-opacity hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100'>
                            Restore
                        </button>
                    </div>
                    {preview?.revision === item.revision && <section id={`thesis-version-${item.revision}`} aria-label='Version preview' className='grid gap-3 border-t border-ui-border p-3'>
                        <p className='text-sm text-ui-muted'>Changes from this saved version to the current workspace. Restore restores all sheets together.</p>
                        {sheetChanges(identifiedSheets(preview.title, preview.body), sheets).length === 0 && <p>No sheet changes.</p>}
                        {sheetChanges(identifiedSheets(preview.title, preview.body), sheets).map(({ before, after }) => <section key={(before || after)!.id} className='grid gap-3'>
                            <h3 className='font-semibold'>{(after || before)!.name} — {!before ? 'Added' : !after ? 'Removed' : 'Changed'}</h3>
                            <div className='grid gap-4 md:grid-cols-2'>
                                <div><h4>Saved version</h4>{before ? <ReadOnlySheet sheet={before} /> : <p>Sheet did not exist.</p>}</div>
                                <div><h4>Current workspace</h4>{after ? <ReadOnlySheet sheet={after} /> : <p>Sheet removed.</p>}</div>
                            </div>
                        </section>)}
                    </section>}
                </li>)}
            </ul>
            {more && <button type='button' disabled={busy} onClick={onLoadMore}>Older versions</button>}
        </section>
        {historyError && <p role='alert' className='text-sm text-ui-text'>{historyError}</p>}
    </>
}
