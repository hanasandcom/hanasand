'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { History, Redo2, Settings2, Undo2 } from 'lucide-react'
import SheetView from './SheetView'
import { sheetButton } from './sheetEditorStyles'
import SheetPageManager from './SheetPageManager'
import type { ActivityLog } from './timetableData'
import CodeReview from './codeReview'
import type { Sheet, SheetSettings } from './workspace'
import { identifiedSheets, writeSheets } from './workspace'
import { MAX_THESIS_BODY_LENGTH } from '@/utils/thesisLimits'
import type { ThesisDocument } from '@/utils/thesis'
import { setThesisNavigation } from '@/utils/layout/thesisNavigation'
import useThesis from './useThesis'
import useThesisHistory from './useThesisHistory'
import VersionHistoryPanel from './VersionHistoryPanel'

function SheetSettingsMenu({ children }: { children: ReactNode }) {
    const id = useId()
    const panel = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    function positionPanel() {
        if (!panel.current || !trigger.current) return
        const box = trigger.current.getBoundingClientRect()
        const height = Math.min(panel.current.offsetHeight || 180, 288)
        panel.current.style.left = `${Math.max(16, Math.min(box.right - 240, window.innerWidth - 256))}px`
        panel.current.style.top = `${Math.max(16, Math.min(box.bottom + 8, window.innerHeight - height - 16))}px`
        panel.current.style.maxHeight = `${Math.max(44, Math.min(288, window.innerHeight - 32))}px`
    }
    useEffect(() => {
        const reposition = () => { if (panel.current?.matches(':popover-open')) positionPanel() }
        window.addEventListener('resize', reposition)
        window.addEventListener('scroll', reposition, true)
        return () => {
            window.removeEventListener('resize', reposition)
            window.removeEventListener('scroll', reposition, true)
        }
    }, [])
    return <>
        <button ref={trigger} type='button' popoverTarget={id} aria-label='Sheet settings' title='Sheet settings' className={sheetButton + ' w-10 px-0'} onClick={() => requestAnimationFrame(positionPanel)}><Settings2 size={18} /></button>
        <div ref={panel} id={id} popover='auto' className='thesis-settings-panel' role='group' aria-label='Features on this sheet'>{children}</div>
    </>
}

export default function ThesisClient({ initialDocument, canEdit }: { initialDocument: ThesisDocument, canEdit: boolean }) {
    const [ready, setReady] = useState(false)
    const [codeToolbar, setCodeToolbar] = useState<HTMLDivElement | null>(null)
    useEffect(() => { setReady(true) }, [])
    const thesis = useThesis(initialDocument, canEdit)
    const { document } = thesis
    const selected = useSearchParams().get('sheet')
    const [validationError, setValidationError] = useState('')
    const sheets = identifiedSheets(document.title, document.body)
    const sheetUrlValue = (sheet: Sheet) => sheet.name?.trim().toLowerCase() === 'code' ? 'code' : sheet.id || ''
    useEffect(() => {
        setThesisNavigation(sheets.map(sheet => ({
            label: sheet.name,
            href: `/thesis?sheet=${encodeURIComponent(sheetUrlValue(sheet))}`,
        })))
    }, [document.body])
    useEffect(() => () => setThesisNavigation([]), [])
    const selectedSheet = sheets.find(sheet => sheet.id === selected || sheetUrlValue(sheet) === selected)
    const active = Math.max(0, selectedSheet ? sheets.indexOf(selectedSheet) : 0)
    function selectSheet(id: string, replace = false) {
        const sheet = sheets.find(item => item.id === id)
        const value = sheet ? sheetUrlValue(sheet) : id
        const url = new URL(window.location.href)
        if (url.searchParams.get('sheet') === value) return
        url.searchParams.set('sheet', value)
        if (replace) window.history.replaceState(null, '', url)
        else window.history.pushState(null, '', url)
    }
    useEffect(() => {
        // History updates can lag behind document edits; do not replace a newer selection.
        if (!ready || !selected || selected !== new URL(window.location.href).searchParams.get('sheet')) return
        if (!selectedSheet) selectSheet(sheets[0].id, true)
        else if (selected !== sheetUrlValue(selectedSheet)) selectSheet(selectedSheet.id!, true)
    }, [ready, selected, document.body])
    const settings = sheets[active].settings || {}
    const codeEnabled = settings.codeReview ?? sheets[active].name.toLowerCase() === 'code'
    function updateSettings(key: keyof SheetSettings, value: boolean) {
        if (!canEdit) return
        const next = sheets.map((sheet, index) => index === active ? { ...sheet, settings: { ...sheet.settings, [key]: value } } : sheet)
        const body = writeSheets(next)
        if (body.length > MAX_THESIS_BODY_LENGTH) { setValidationError('The workspace is full.'); return }
        thesis.update('body', body)
        if (key === 'history' && !value) versionHistory.close()
    }
    function updateActivityLog(activityLog: ActivityLog) {
        if (!canEdit) return false
        const body = writeSheets(sheets.map((sheet, index) => index === active ? { ...sheet, activityLog } : sheet))
        if (body.length > MAX_THESIS_BODY_LENGTH) { setValidationError('The workspace is full.'); return false }
        setValidationError('')
        thesis.update('body', body)
        return true
    }
    function updateSheet(field: 'title' | 'body', value: string, group?: string) {
        const next = sheets.map((sheet, index) => index === active ? { ...sheet, [field]: value } : sheet)
        if (field === 'title' && (!value.trim() || value.length > 500)) { setValidationError('Enter a title of 1–500 characters.'); return }
        const body = writeSheets(next)
        if (body.length > MAX_THESIS_BODY_LENGTH) { setValidationError('The workspace is full. Shorten the content before adding more.'); return }
        setValidationError('')
        thesis.update('body', body, group ? `${sheets[active].id}:${group}` : undefined)
    }
    const [busy, setBusy] = useState(false)
    const versionHistory = useThesisHistory(thesis, setBusy)

    return (
        <section className='mx-auto box-border grid w-full max-w-[210mm] min-w-0 gap-6 px-4 pt-3 pb-32 text-ui-text md:px-6' aria-label='Thesis document'
            onKeyDownCapture={event => {
                if (!canEdit || event.nativeEvent.isComposing || (event.target as HTMLElement).closest('dialog, .code-workspace, .code-access, .thesis-timetable input, .thesis-timetable textarea, .thesis-timetable select, .thesis-timetable-controls')) return
                if (!(event.metaKey || event.ctrlKey) || event.altKey) return
                const key = event.key.toLowerCase()
                if (key !== 'z' && key !== 'y') return
                event.preventDefault(); event.stopPropagation()
                if (busy) return
                if (key === 'y' || event.shiftKey) thesis.redo()
                else thesis.undo()
            }}
            onMouseDownCapture={event => {
                // Keep the active line stable until a document control has received its click. Keyboard focus still behaves normally.
                if (!(event.target as HTMLElement).closest('dialog, .code-workspace, .code-access, .thesis-timetable, .thesis-timetable-controls') && (event.target as HTMLElement).closest('button, [role=button]')) event.preventDefault()
            }}>
            <div role='tabpanel' id={`sheet-${active}`} aria-labelledby={`tab-${active}`}>
                <SheetView onActivityLogChange={updateActivityLog} contentOnly={codeEnabled} key={sheets[active].id} sheet={sheets[active]} canEdit={canEdit && ready} onChange={updateSheet} showInsertTable={settings.insertTable !== false}
                    trailingActions={canEdit && <SheetSettingsMenu key={sheets[active].id}>
                        <strong>Features on this sheet</strong>
                        <label><input type='checkbox' checked={settings.insertTable !== false} onChange={event => updateSettings('insertTable', event.target.checked)} />Insert table</label>
                        <label><input type='checkbox' checked={settings.history !== false} onChange={event => updateSettings('history', event.target.checked)} />History</label>
                        <label><input type='checkbox' checked={codeEnabled} onChange={event => updateSettings('codeReview', event.target.checked)} />Code review</label>
                    </SheetSettingsMenu>}
                    actions={(canEdit || codeEnabled) && <>
                        {codeEnabled && <div ref={setCodeToolbar} className='flex' />}
                        {canEdit && <>
                            <SheetPageManager sheets={sheets} activeSheet={sheets[active]} canEdit={canEdit} ready={ready} onSave={body => thesis.update('body', body)} onSelectSheet={selectSheet} onSaved={() => setValidationError('')} />
                            <button type='button' disabled={!thesis.canUndo || busy} onClick={thesis.undo} aria-label='Undo' title='Undo (Ctrl/⌘ Z)' className={sheetButton + ' w-10 px-0'}><Undo2 size={18} /></button>
                            <button type='button' disabled={!thesis.canRedo || busy} onClick={thesis.redo} aria-label='Redo' title='Redo (Ctrl/⌘ Shift Z)' className={sheetButton + ' w-10 px-0'}><Redo2 size={18} /></button>
                            {settings.history !== false && <button type='button' disabled={busy || !ready} aria-expanded={versionHistory.history !== null} aria-label={versionHistory.history === null ? 'History' : 'Close history'} title={versionHistory.history === null ? 'History' : 'Close history'} onClick={() => versionHistory.history === null ? versionHistory.load() : versionHistory.close()} className={sheetButton + ' w-10 px-0'}>
                                <History size={18} />
                            </button>}
                        </>}
                    </>} />
                {ready && codeEnabled && <CodeReview canReview={canEdit} toolbar={codeToolbar} />}
            </div>
            {validationError && <p role='alert' className='text-sm text-ui-text'>{validationError}</p>}
            {canEdit ? (
                <>
                    {thesis.error && <p role='alert' className='text-sm text-ui-text'>{thesis.error}</p>}
                    {thesis.conflict && (
                        <div className='flex flex-wrap gap-3'>
                            <button type='button' onClick={() => thesis.resolve(true)} className='rounded-lg border border-ui-border px-3 py-2'>Use my draft</button>
                            <button type='button' onClick={() => thesis.resolve(false)} className='rounded-lg border border-ui-border px-3 py-2'>Use latest version</button>
                        </div>
                    )}
                    {thesis.recoveries.map(item => (
                        <button key={item.key} type='button' onClick={() => thesis.recover(item)} className='rounded-lg border border-ui-border px-3 py-2 text-left'>
                            Recover browser draft: {item.title} — {new Date(item.savedAt).toLocaleString()}
                        </button>
                    ))}
                    {settings.history !== false && versionHistory.history !== null && <VersionHistoryPanel
                        history={versionHistory.history}
                        preview={versionHistory.preview}
                        historyError={versionHistory.error}
                        historyHelp={versionHistory.helpOpen}
                        busy={busy}
                        conflict={thesis.conflict}
                        more={versionHistory.hasMore}
                        sheets={sheets}
                        onToggleHelp={() => versionHistory.setHelpOpen(!versionHistory.helpOpen)}
                        onShowVersion={versionHistory.showVersion}
                        onRestore={versionHistory.restore}
                        onLoadMore={() => void versionHistory.load(true)}
                    />}
                </>
            ) : null}
        </section>
    )
}
