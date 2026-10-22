import { Clock3, List, Plus, Search, StickyNote, X } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'
import NotesPanelIconButton from './NotesPanelIconButton'

export function NotesSidebar({
    collapsed,
    notes,
    totalCount,
    selectedId,
    query,
    onCollapse,
    onNewNote,
    onQueryChange,
    onSelectNote,
}: {
    collapsed: boolean
    notes: Note[]
    totalCount: number
    selectedId: string
    query: string
    onCollapse: (collapsed: boolean) => void
    onNewNote: () => void
    onQueryChange: (query: string) => void
    onSelectNote: (id: string) => void
}) {
    return (
        <DashboardPanel className={`grid content-start gap-3 border-ui-border bg-ui-panel p-3 ${collapsed ? 'xl:px-2' : ''}`}>
            {collapsed ? (
                <div className='grid justify-items-center gap-2'>
                    <NotesPanelIconButton label='Open notes sidebar' onClick={() => onCollapse(false)}><List className='h-4 w-4' /></NotesPanelIconButton>
                    <button type='button' onClick={onNewNote} aria-label='New note' title='New note' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-raised text-ui-primary hover:border-ui-primary'>
                        <Plus className='h-4 w-4' />
                    </button>
                    <NotesPanelIconButton label='Search notes' onClick={() => onCollapse(false)}><Search className='h-4 w-4' /></NotesPanelIconButton>
                    <NotesPanelIconButton label='Show note list' onClick={() => onCollapse(false)}><StickyNote className='h-4 w-4' /></NotesPanelIconButton>
                </div>
            ) : (
                <>
                    <div className='flex items-center justify-between gap-2'>
                        <span className='text-sm font-semibold text-ui-text'>Notes</span>
                        <button type='button' onClick={() => onCollapse(true)} aria-label='Close notes sidebar' title='Close notes sidebar' className='grid h-8 w-8 place-items-center rounded-md text-ui-muted hover:bg-ui-raised hover:text-ui-text'>
                            <X className='h-4 w-4' />
                        </button>
                    </div>
                    <button
                        onClick={onNewNote}
                        className='flex h-9 w-full items-center justify-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'
                    >
                        <Plus className='h-4 w-4 text-ui-primary' />
                        New note
                    </button>
                    <div className='rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
                        <div className='flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                            <Search className='h-3.5 w-3.5' />
                            Search notes
                        </div>
                        <input
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            placeholder='Title or content'
                            className='mt-2 h-8 w-full rounded-md border border-ui-border bg-ui-panel px-2.5 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                        />
                        <div className='mt-2 text-xs font-semibold text-ui-muted'>{notes.length}/{totalCount} visible</div>
                    </div>
                    <div className='grid max-h-[calc(100vh-17rem)] gap-1 overflow-auto pr-1'>
                        {notes.map((note) => (
                            <button
                                key={note.id}
                                onClick={() => onSelectNote(note.id)}
                                className={`rounded-md border px-3 py-2 text-left transition ${
                                    note.id === selectedId
                                        ? 'border-ui-primary bg-ui-raised text-ui-text'
                                        : 'border-ui-border bg-ui-panel text-ui-muted hover:border-ui-primary hover:bg-ui-raised'
                                }`}
                            >
                                <div className='truncate text-sm font-semibold'>{note.title || 'Untitled'}</div>
                                <div className='mt-0.5 flex items-center gap-1 truncate text-xs text-ui-muted'>
                                    <Clock3 className='h-3 w-3' />
                                    {formatNoteDate(note.updated_at)}
                                </div>
                            </button>
                        ))}
                        {Boolean(totalCount && !notes.length) && (
                            <div className='rounded-md border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
                                No notes match that search.
                            </div>
                        )}
                    </div>
                </>
            )}
        </DashboardPanel>
    )
}

export function formatNoteDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
