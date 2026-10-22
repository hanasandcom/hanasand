import { ChartNoAxesColumnIncreasing, Clock3, FileText, StickyNote } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'
import { formatNoteDate } from './NotesSidebar'
import NotesPanelIconButton from './NotesPanelIconButton'

export function NotesAnalyticsPanel({ collapsed, noteCount, wordCount, lastUpdated, recentNotes, onCollapse, onSelectNote }: {
    collapsed: boolean
    noteCount: number
    wordCount: number
    lastUpdated: string
    recentNotes: Note[]
    onCollapse: (collapsed: boolean) => void
    onSelectNote: (id: string) => void
}) {
    return (
        <DashboardPanel className={`grid content-start gap-3 border-ui-border bg-ui-panel p-3 ${collapsed ? 'xl:px-2' : ''}`}>
            {collapsed ? (
                <NotesPanelIconButton label='Open note analytics' onClick={() => onCollapse(false)}><ChartNoAxesColumnIncreasing className='h-4 w-4' /></NotesPanelIconButton>
            ) : (
                <>
                    <div className='flex justify-end'>
                        <button type='button' onClick={() => onCollapse(true)} aria-label='Close note analytics' title='Close note analytics' className='grid h-8 w-8 place-items-center rounded-md text-ui-muted hover:bg-ui-raised hover:text-ui-text'>
                            <ChartNoAxesColumnIncreasing className='h-4 w-4' />
                        </button>
                    </div>
                    <SideFact icon={<StickyNote className='h-4 w-4' />} label='Notes' value={String(noteCount)} />
                    <SideFact icon={<FileText className='h-4 w-4' />} label='Words' value={String(wordCount)} />
                    <SideFact icon={<Clock3 className='h-4 w-4' />} label='Updated' value={lastUpdated} />
                    <div className='rounded-md border border-ui-border bg-ui-raised p-3'>
                        <p className='text-xs font-semibold text-ui-muted'>Recent</p>
                        <div className='mt-2 grid gap-2'>
                            {recentNotes.slice(0, 4).map((note) => (
                                <button key={note.id} type='button' onClick={() => onSelectNote(note.id)} className='text-left'>
                                    <p className='truncate text-sm font-semibold text-ui-text'>{note.title || 'Untitled'}</p>
                                    <p className='truncate text-xs text-ui-muted'>{formatNoteDate(note.updated_at)}</p>
                                </button>
                            ))}
                            {Boolean(noteCount && !recentNotes.length) && <p className='text-sm text-ui-muted'>Search has no matches.</p>}
                        </div>
                    </div>
                </>
            )}
        </DashboardPanel>
    )
}

function SideFact({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised p-3'>
            <div className='flex items-center gap-2 text-ui-muted'>
                {icon}
                <span className='text-xs font-semibold'>{label}</span>
            </div>
            <p className='mt-1 truncate text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}
