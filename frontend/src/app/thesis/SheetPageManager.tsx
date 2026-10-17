'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Copy, Menu } from 'lucide-react'
import { MAX_THESIS_BODY_LENGTH } from '@/utils/thesisLimits'
import type { Sheet } from './workspace'
import { writeSheets } from './workspace'
import { sheetButton } from './sheetEditorStyles'

type Dialog = { kind: 'add' } | { kind: 'delete', id: string, name: string }

type Props = {
    sheets: Sheet[]
    activeSheet: { id: string, name: string }
    canEdit: boolean
    ready: boolean
    onSave: (body: string) => void
    onSelectSheet: (id: string, replace?: boolean) => void
    onSaved: () => void
}

export default function SheetPageManager({ sheets, activeSheet, canEdit, ready, onSave, onSelectSheet, onSaved }: Props) {
    const menuId = useId()
    const menu = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDialogElement>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const [dialog, setDialog] = useState<Dialog | null>(null)
    const [sheetName, setSheetName] = useState('')
    const [dialogError, setDialogError] = useState('')
    const [copyMessage, setCopyMessage] = useState('')

    useEffect(() => {
        if (dialog) dialogRef.current?.showModal()
        else if (triggerRef.current) {
            const target = triggerRef.current.isConnected
                ? triggerRef.current
                : window.document.querySelector<HTMLAnchorElement>('[data-thesis-sheet-link][aria-current="page"]')
            target?.focus()
        }
    }, [dialog])

    const deleteTarget = dialog?.kind === 'delete'
        ? sheets.find(sheet => sheet.id === dialog.id && sheet.name === dialog.name)
        : undefined

    function positionMenu() {
        if (!menu.current || !trigger.current) return
        const box = trigger.current.getBoundingClientRect()
        const height = menu.current.offsetHeight || 100
        menu.current.style.left = `${Math.max(16, Math.min(box.right - 224, window.innerWidth - 240))}px`
        menu.current.style.top = `${Math.max(16, Math.min(box.bottom + 8, window.innerHeight - height - 16))}px`
    }

    function openDialog(next: Dialog, button: HTMLButtonElement) {
        triggerRef.current = button
        setSheetName('')
        setDialogError('')
        setCopyMessage('')
        setDialog(next)
    }

    function closeDialog() {
        dialogRef.current?.close()
        setDialog(null)
    }

    function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!canEdit || !dialog) return
        if (dialog.kind === 'add') {
            const name = sheetName.trim()
            if (!name || name.length > 100) {
                setDialogError('Enter a page name of 1–100 characters.')
                return
            }
            const id = crypto.randomUUID()
            const body = writeSheets([...sheets, { id, name, title: `# ${name}`, body: '' }])
            if (body.length > MAX_THESIS_BODY_LENGTH) {
                setDialogError('The workspace is full.')
                return
            }
            onSave(body)
            onSelectSheet(id)
        } else {
            if (!deleteTarget || sheets.length === 1 || sheetName !== deleteTarget.name) return
            const index = sheets.findIndex(sheet => sheet.id === deleteTarget.id)
            onSave(writeSheets(sheets.filter(sheet => sheet.id !== deleteTarget.id)))
            onSelectSheet(sheets[index > 0 ? index - 1 : 1].id!, true)
        }
        onSaved()
        closeDialog()
    }

    return <>
        <button ref={trigger} type='button' popoverTarget={menuId} aria-label='Page menu' title='Page menu' className={sheetButton + ' w-10 px-0'} onClick={() => requestAnimationFrame(positionMenu)}><Menu size={18} /></button>
        <div ref={menu} id={menuId} popover='auto' className='thesis-page-actions-panel' role='group' aria-label='Page actions'>
            <button type='button' className={sheetButton} onClick={() => trigger.current && openDialog({ kind: 'add' }, trigger.current)}>New page</button>
            <button type='button' className={sheetButton} disabled={!ready || sheets.length === 1} onClick={() => trigger.current && openDialog({ kind: 'delete', id: activeSheet.id, name: activeSheet.name }, trigger.current)}>Delete page</button>
        </div>
        {canEdit && dialog && <dialog ref={dialogRef} className='thesis-sheet-dialog' aria-labelledby='sheet-dialog-title' onCancel={event => { event.preventDefault(); closeDialog() }}>
            <form onSubmit={submit} className='grid gap-5'>
                <h2 id='sheet-dialog-title' className='text-lg font-semibold'>{dialog.kind === 'add' ? 'New page' : 'Delete this page?'}</h2>
                {dialog.kind === 'delete' && <div className='text-sm leading-6 text-ui-muted'>
                    <p>This deletes the page and its content. Earlier saved versions remain in shared History.</p>
                    <div id='sheet-name-instruction' className='mt-3'>
                        Enter “<span className='font-semibold text-ui-text'>{dialog.name}</span>” <button type='button' className='inline-flex rounded-md p-2 align-middle text-ui-text hover:bg-ui-raised' aria-label='Copy page name' onClick={async () => {
                            try { await navigator.clipboard.writeText(dialog.name); setCopyMessage('Page name copied.') }
                            catch { setCopyMessage('Could not copy. Select the page name above and copy it manually.') }
                        }}><Copy size={16} aria-hidden='true' /></button> below to confirm.
                    </div>
                    <p role='status'>{copyMessage}</p>
                </div>}
                <label className='grid gap-2 text-sm font-medium'>
                    {dialog.kind === 'add' ? 'Page name' : 'Confirm page name'}
                    <input autoFocus value={sheetName} onChange={event => setSheetName(event.target.value)} maxLength={dialog.kind === 'add' ? 100 : undefined} autoComplete='off' aria-describedby={dialog.kind === 'delete' ? 'sheet-name-instruction' : undefined} className='w-full rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-ui-text outline-none focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15' />
                </label>
                {dialog.kind === 'delete' && (!deleteTarget || sheets.length === 1) && <p role='alert' className='text-sm text-ui-text'>This page can no longer be deleted. Close this dialog and check the current pages.</p>}
                {dialogError && <p role='alert' className='text-sm text-ui-text'>{dialogError}</p>}
                <div className='flex justify-between gap-3 pt-2'>
                    <button type='button' onClick={closeDialog} className='rounded-md border border-ui-border bg-ui-raised px-4 py-2 text-sm font-semibold text-ui-muted hover:text-ui-text'>Cancel</button>
                    <button type='submit' disabled={dialog.kind === 'add' ? !sheetName.trim() : !deleteTarget || sheets.length === 1 || sheetName !== dialog.name} className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${dialog.kind === 'delete' ? 'bg-ui-raised text-ui-text' : 'bg-ui-primary text-ui-on-primary'}`}>{dialog.kind === 'add' ? 'Create page' : 'Delete page'}</button>
                </div>
            </form>
        </dialog>}
    </>
}
