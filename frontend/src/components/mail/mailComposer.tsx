'use client'

import { useState, type FormEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import type { ComposeDraft } from './useMailWorkspace'

async function encodeFile(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
    return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, contentBase64: btoa(binary) }
}

export function MailComposer({ initial, busy, onClose, onSend }: {
    initial: ComposeDraft
    busy: boolean
    onClose: () => void
    onSend: (draft: ComposeDraft) => void
}) {
    const [draft, setDraft] = useState(initial)
    const [showCc, setShowCc] = useState(Boolean(initial.cc))
    const [showBcc, setShowBcc] = useState(Boolean(initial.bcc))
    const [fileError, setFileError] = useState('')
    function field(key: keyof Omit<ComposeDraft, 'attachments'>, value: string) { setDraft(current => ({ ...current, [key]: value })) }
    async function attach(files: FileList | null) {
        if (!files?.length) return
        setFileError('')
        try {
            const added = await Promise.all(Array.from(files).map(encodeFile))
            setDraft(current => ({ ...current, attachments: [...current.attachments, ...added] }))
        } catch { setFileError('Could not read the selected attachment.') }
    }
    function submit(event: FormEvent) { event.preventDefault(); onSend(draft) }
    return <div className='fixed inset-0 z-[1400] grid place-items-center bg-black/50 p-3' role='presentation' onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <form onSubmit={submit} aria-label='Compose email' className='flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ui-border bg-ui-panel shadow-2xl'>
            <header className='flex items-center border-b border-ui-border px-4 py-3'><h2 className='flex-1 font-semibold text-ui-text'>New message</h2><button type='button' aria-label='Close composer' onClick={onClose} className='rounded-md p-2 text-ui-muted hover:bg-ui-raised'><X className='h-4 w-4' /></button></header>
            <div className='grid gap-2 overflow-y-auto p-4'>
                <label className='grid gap-1 text-xs font-medium text-ui-muted [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-ui-border [&_input]:bg-ui-raised [&_input]:px-3 [&_input]:text-sm [&_input]:text-ui-text [&_input]:outline-none [&_input]:focus:border-ui-primary'>To<input required autoFocus value={draft.to} onChange={event => field('to', event.target.value)} placeholder='name@example.com' /></label>
                <div className='flex gap-3 text-xs'><button type='button' onClick={() => setShowCc(value => !value)} className='text-ui-primary'>Cc</button><button type='button' onClick={() => setShowBcc(value => !value)} className='text-ui-primary'>Bcc</button></div>
                {showCc && <label className='grid gap-1 text-xs font-medium text-ui-muted [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-ui-border [&_input]:bg-ui-raised [&_input]:px-3 [&_input]:text-sm [&_input]:text-ui-text [&_input]:outline-none [&_input]:focus:border-ui-primary'>Cc<input value={draft.cc} onChange={event => field('cc', event.target.value)} /></label>}
                {showBcc && <label className='grid gap-1 text-xs font-medium text-ui-muted [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-ui-border [&_input]:bg-ui-raised [&_input]:px-3 [&_input]:text-sm [&_input]:text-ui-text [&_input]:outline-none [&_input]:focus:border-ui-primary'>Bcc<input value={draft.bcc} onChange={event => field('bcc', event.target.value)} /></label>}
                <label className='grid gap-1 text-xs font-medium text-ui-muted [&_input]:h-9 [&_input]:rounded-lg [&_input]:border [&_input]:border-ui-border [&_input]:bg-ui-raised [&_input]:px-3 [&_input]:text-sm [&_input]:text-ui-text [&_input]:outline-none [&_input]:focus:border-ui-primary'>Subject<input value={draft.subject} onChange={event => field('subject', event.target.value)} /></label>
                <label className='sr-only' htmlFor='mail-compose-body'>Message</label><textarea id='mail-compose-body' required value={draft.textBody} onChange={event => field('textBody', event.target.value)} placeholder='Write your message…' className='min-h-56 resize-y rounded-lg border border-ui-border bg-ui-raised p-3 text-sm text-ui-text outline-none focus:border-ui-primary' />
                <label className='inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text'><Paperclip className='h-4 w-4' />Attach files<input type='file' multiple className='sr-only' onChange={event => void attach(event.target.files)} /></label>
                {draft.attachments.map((file, index) => <div key={`${file.name}-${index}`} className='flex items-center gap-2 text-xs text-ui-muted'>{file.name}<button type='button' aria-label={`Remove ${file.name}`} onClick={() => setDraft(current => ({ ...current, attachments: current.attachments.filter((_, item) => item !== index) }))} className='text-ui-primary'>Remove</button></div>)}
                {fileError && <p role='alert' className='text-xs text-ui-danger'>{fileError}</p>}
            </div>
            <footer className='flex justify-end border-t border-ui-border p-3'><button type='submit' disabled={busy || !draft.to.trim()} className='inline-flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-50'><Send className='h-4 w-4' />{busy ? 'Sending…' : 'Send'}</button></footer>
        </form>
    </div>
}
