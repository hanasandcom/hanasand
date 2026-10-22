'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { createNote, deleteNote, fetchNotes, updateNote } from '@/utils/notes/client'
import { DashboardPanel } from 'hanasand/dashboard'
import { formatNoteDate, NotesSidebar } from './NotesSidebar'
import { NotesAnalyticsPanel } from './NotesAnalyticsPanel'
import { resolveSelectedNote, saveNoteDraft } from './notesModel'

const emptyDraft = { title: '', content: '' }

export default function NotesClient() {
    const [notes, setNotes] = useState<Note[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [draft, setDraft] = useState(emptyDraft)
    const [query, setQuery] = useState('')
    const [message, setMessage] = useState('')
    const [busy, setBusy] = useState(false)
    const [leftCollapsed, setLeftCollapsed] = useState(false)
    const [rightCollapsed, setRightCollapsed] = useState(false)
    const sortedNotes = useMemo(() => [...notes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()), [notes])
    const visibleNotes = useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (!needle) return sortedNotes
        return sortedNotes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(needle))
    }, [query, sortedNotes])
    const selected = useMemo(() => resolveSelectedNote(sortedNotes, selectedId), [sortedNotes, selectedId])
    const wordCount = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0
    const lastUpdated = selected ? formatNoteDate(selected.updated_at) : 'New note'

    useEffect(() => {
        void load()
    }, [])

    useEffect(() => {
        if (!selected) {
            setDraft(emptyDraft)
            return
        }

        setDraft({ title: selected.title, content: selected.content })
    }, [selected])

    async function load() {
        setBusy(true)
        try {
            const next = await fetchNotes()
            setNotes(next)
            const ordered = [...next].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            setSelectedId((current) => current && next.some((note) => note.id === current) ? current : ordered[0]?.id || '')
            setMessage('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not load notes.')
        } finally {
            setBusy(false)
        }
    }

    async function save() {
        if (!draft.title.trim() && !draft.content.trim()) {
            setMessage('Write something first.')
            return
        }

        setBusy(true)
        try {
            const saved = await saveNoteDraft(selected, draft, { create: createNote, update: updateNote })
            setNotes((current) => {
                const rest = current.filter((note) => note.id !== saved.id)
                return [saved, ...rest]
            })
            setSelectedId(saved.id)
            setMessage('Saved.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save note.')
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!selected) return
        setBusy(true)
        try {
            await deleteNote(selected.id)
            setNotes((current) => current.filter((note) => note.id !== selected.id))
            setSelectedId('')
            setDraft(emptyDraft)
            setMessage('Deleted.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not delete note.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className={`grid gap-3 ${leftCollapsed ? (rightCollapsed ? 'xl:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem]' : 'xl:grid-cols-[3.5rem_minmax(0,1fr)_17rem]') : (rightCollapsed ? 'xl:grid-cols-[19rem_minmax(0,1fr)_3.5rem]' : 'xl:grid-cols-[19rem_minmax(0,1fr)_17rem]')}`}>
            <NotesSidebar
                collapsed={leftCollapsed}
                notes={visibleNotes}
                totalCount={sortedNotes.length}
                selectedId={selectedId}
                query={query}
                onCollapse={setLeftCollapsed}
                onNewNote={() => {
                    setSelectedId('')
                    setDraft(emptyDraft)
                }}
                onQueryChange={setQuery}
                onSelectNote={setSelectedId}
            />

            <DashboardPanel className='grid min-h-0 content-start border-ui-border bg-ui-panel p-3'>
                <div className='mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-ui-border pb-3'>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-ui-text'>{draft.title || selected?.title || 'Untitled'}</p>
                    </div>
                    <div className='flex gap-2'>
                        {selected && (
                            <button onClick={() => void remove()} className='inline-flex h-8 items-center gap-2 rounded-md border border-ui-danger bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-panel'>
                                <Trash2 className='h-3.5 w-3.5' />
                                Delete
                            </button>
                        )}
                        <button onClick={() => void save()} className='inline-flex h-8 items-center gap-2 rounded-md bg-ui-primary/80 px-3 text-xs font-semibold text-ui-on-primary transition hover:bg-ui-primary/70'>
                            <Check className='h-3.5 w-3.5' />
                            Save
                        </button>
                    </div>
                </div>
                <div className='grid gap-2'>
                    <input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        placeholder='Title'
                        className='rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-base font-semibold text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <textarea
                        value={draft.content}
                        onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                        placeholder='Write a note...'
                        className='min-h-56 resize-y rounded-md border border-ui-border bg-ui-raised px-3 py-3 text-sm leading-6 text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    {(message || busy || selected) && <p className='text-sm text-ui-muted'>{message || (busy ? 'Syncing...' : selected ? `Saved from ${formatSource(selected.source)}.` : '')}</p>}
                </div>
            </DashboardPanel>

            <NotesAnalyticsPanel
                collapsed={rightCollapsed}
                noteCount={sortedNotes.length}
                wordCount={wordCount}
                lastUpdated={lastUpdated}
                recentNotes={visibleNotes}
                onCollapse={setRightCollapsed}
                onSelectNote={setSelectedId}
            />
        </div>
    )
}

function formatSource(value: string) {
    if (!value) return 'app'
    return value.replace(/[-_]/g, ' ')
}
