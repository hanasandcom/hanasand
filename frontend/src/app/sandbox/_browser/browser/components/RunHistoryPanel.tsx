import { useState } from 'react'
import { Check, ListChecks, LoaderCircle, MoreHorizontal, Share2, Square, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { BrowserQuota, BrowserRunHistory } from '../types'
import { runDurationLabel } from '../historyData'
import { ProviderBadges } from './ProviderBadges'

export function HistoryPanel({ history, quota, embedded = false, historyReady, onDelete, onShare }: {
    history: BrowserRunHistory[]
    quota: BrowserQuota | null
    embedded?: boolean
    historyReady: boolean
    onDelete: (ids?: string[]) => Promise<void>
    onShare: (run: BrowserRunHistory) => Promise<string>
}) {
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [openMenuId, setOpenMenuId] = useState('')
    const [busyId, setBusyId] = useState('')
    const [busyClear, setBusyClear] = useState(false)
    const [message, setMessage] = useState('')
    const visibleHistory = history.filter(run => run.resultId)
    const toggleSelected = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
    const runAction = async (action: () => Promise<void>, busy: string, success?: string) => {
        setBusyId(busy)
        setMessage('')
        try {
            await action()
            if (success) setMessage(success)
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return
            setMessage(error instanceof Error ? error.message : 'The action failed.')
        } finally {
            setBusyId('')
        }
    }

    return (
        <section className={embedded ? 'grid gap-3 border-t border-ui-border pt-3' : 'grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-4'}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold text-ui-text'>Recent browser runs</h2>
                    {quota && !quota.paid ? <Link href='/pricing#browser' className='text-xs font-semibold text-ui-primary'>{quota.identityKind === 'user' ? 'View plans for longer runs and advanced analysis' : 'Upgrade for 30-minute runs and advanced analysis'}</Link> : null}
                    <p className='mt-1 text-xs text-ui-muted'>{quota ? `${runDurationLabel(quota.sessionSeconds || 90)} per run · ${quota.concurrentLimit === null ? 'no simultaneous-browser limit' : `${quota.concurrentLimit} simultaneous browser${quota.concurrentLimit === 1 ? '' : 's'}`} · ${quota.limit === null ? 'no daily run limit' : `${quota.used}/${quota.limit} runs today`}` : 'Checking your signed-in session…'}</p>
                </div>
                <div className='flex items-center gap-1.5'>
                    {selectionMode && selectedIds.length ? <button type='button' disabled={Boolean(busyId) || busyClear} onClick={() => void runAction(async () => { await onDelete(selectedIds); setSelectedIds([]) }, 'selected', 'Selected runs deleted.')} className='rounded-md border border-ui-border px-2.5 py-1.5 text-xs font-semibold text-ui-text hover:border-ui-primary disabled:opacity-50'>Delete selected ({selectedIds.length})</button> : null}
                    <button type='button' disabled={!visibleHistory.length || Boolean(busyId) || busyClear} onClick={() => {
                        setBusyClear(true)
                        setMessage('')
                        void onDelete().then(() => { setSelectedIds([]); setSelectionMode(false); setMessage('Recent runs cleared.') })
                            .catch(error => setMessage(error instanceof Error ? error.message : 'Could not clear browser history.'))
                            .finally(() => setBusyClear(false))
                    }} className='rounded-md border border-ui-border px-2.5 py-1.5 text-xs font-semibold text-ui-text hover:border-ui-primary disabled:opacity-50'>Clear</button>
                    <button type='button' disabled={!visibleHistory.length} onClick={() => {
                        setSelectionMode(current => !current)
                        setSelectedIds([])
                        setMessage('')
                    }} className={`grid h-8 w-8 place-items-center rounded-md border border-ui-border text-ui-muted hover:border-ui-primary hover:text-ui-text disabled:opacity-50 ${selectionMode ? 'border-ui-primary text-ui-primary' : ''}`} aria-label={selectionMode ? 'Done selecting runs' : 'Select runs'} title={selectionMode ? 'Done selecting' : 'Select runs'}>
                        <ListChecks className='h-4 w-4' />
                    </button>
                </div>
            </div>
            {message ? <p role='status' className='text-xs text-ui-muted'>{message}</p> : null}
            <div className='grid max-h-[10.75rem] gap-2 overflow-y-auto pr-1'>
                {visibleHistory.map(run => (
                    <article key={run.id} className='relative flex min-w-0 items-center gap-2 rounded-md border border-ui-border bg-ui-raised p-2 text-xs transition hover:border-ui-primary'>
                        {selectionMode ? <button type='button' onClick={() => toggleSelected(run.id)} className='grid h-7 w-7 shrink-0 place-items-center rounded text-ui-muted hover:text-ui-text' aria-label={`${selectedIds.includes(run.id) ? 'Deselect' : 'Select'} ${run.target}`} aria-pressed={selectedIds.includes(run.id)}>
                            {selectedIds.includes(run.id) ? <Check className='h-4 w-4 text-ui-primary' /> : <Square className='h-4 w-4' />}
                        </button> : null}
                        <Link href={`/sandbox/${run.resultId}`} className='grid min-w-0 flex-1 gap-2 focus-visible:outline-2 focus-visible:outline-ui-primary md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center'>
                            <span className='min-w-0 truncate text-left font-mono text-ui-text'>{run.target}</span>
                            <ProviderBadges results={run.providerResults} />
                            <span className='whitespace-nowrap text-ui-muted'>{new Date(run.startedAt).toLocaleString()}</span>
                        </Link>
                        <RunHistoryActions
                            density='panel'
                            target={run.target}
                            disabled={Boolean(busyId) || busyClear}
                            sharing={busyId === `share-${run.id}`}
                            menuOpen={openMenuId === run.id}
                            onShare={() => { void runAction(async () => { setMessage(await onShare(run)) }, `share-${run.id}`) }}
                            onToggleMenu={() => setOpenMenuId(current => current === run.id ? '' : run.id)}
                            onDelete={() => { setOpenMenuId(''); void runAction(() => onDelete([run.id]), `delete-${run.id}`, 'Run deleted.') }}
                        />
                    </article>
                ))}
                {!visibleHistory.length ? <div className='rounded-md border border-dashed border-ui-border p-3 text-xs text-ui-muted'>{historyReady ? 'No browser runs recorded yet.' : 'Loading browser runs…'}</div> : null}
            </div>
        </section>
    )
}

export function RunHistoryActions({ target, density, disabled, sharing, menuOpen, onShare, onToggleMenu, onDelete }: {
    target: string
    density: 'dialog' | 'panel'
    disabled: boolean
    sharing: boolean
    menuOpen: boolean
    onShare: () => void
    onToggleMenu: () => void
    onDelete: () => void
}) {
    const size = density === 'panel' ? 'h-7 w-7' : 'h-8 w-8'
    const menuTop = density === 'panel' ? 'top-8' : 'top-9'
    return <>
        <button type='button' disabled={disabled} onClick={onShare}
            className={`grid ${size} shrink-0 place-items-center rounded text-ui-muted hover:text-ui-text disabled:opacity-50`}
            aria-label={`Share finding for ${target}`} title='Share finding'>
            {sharing ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Share2 className='h-4 w-4' />}
        </button>
        <div className='relative shrink-0'>
            <button type='button' disabled={disabled} onClick={onToggleMenu}
                className={`grid ${size} place-items-center rounded text-ui-muted hover:text-ui-text disabled:opacity-50`}
                aria-label={`More options for ${target}`} aria-expanded={menuOpen} title='More options'>
                <MoreHorizontal className='h-4 w-4' />
            </button>
            {menuOpen ? <div className={`absolute right-0 ${menuTop} z-20 min-w-28 rounded-md border border-ui-border bg-ui-panel p-1 shadow-lg`}>
                <button type='button' onClick={onDelete} className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ui-text hover:bg-ui-raised'>
                    <Trash2 className='h-3.5 w-3.5' />{density === 'panel' ? ' Delete' : 'Delete'}
                </button>
            </div> : null}
        </div>
    </>
}
