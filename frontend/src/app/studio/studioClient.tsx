'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { createDeviceProof } from '@/utils/auth/deviceProof'
import type { StudioDocument } from '@/utils/studio'
import MarkdownDocumentEditor from '@/components/markdown/MarkdownDocumentEditor'
import uploadMarkdownImage from '@/components/markdown/uploadMarkdownImage'

const same = (a: StudioDocument, b: StudioDocument) => a.id === b.id && a.title === b.title && a.body === b.body
const clearDraft = (key: string, saved: StudioDocument) => {
    sessionStorage.removeItem(key)
    try {
        const shared = JSON.parse(localStorage.getItem(key) || 'null') as StudioDocument | null
        if (shared && same(shared, saved)) localStorage.removeItem(key)
    } catch { /* Keep a damaged backup for manual recovery. */ }
}

export default function StudioClient({ initialDocument, canEdit }: { initialDocument: StudioDocument, canEdit: boolean }) {
    const router = useRouter()
    const draftKey = `hanasand-studio-draft:${initialDocument.id}`
    const [document, setDocument] = useState(initialDocument)
    const [status, setStatus] = useState('Saved')
    const [conflict, setConflict] = useState<StudioDocument | null>(null)
    const [recovery, setRecovery] = useState<StudioDocument | null>(null)
    const [titleEditing, setTitleEditing] = useState(false)
    const draft = useRef(initialDocument)
    const base = useRef(initialDocument)
    const conflictRef = useRef<StudioDocument | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saving = useRef(false)
    const stopped = useRef(false)
    const saveRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => {})

    const updateField = useCallback((field: 'body' | 'title', value: string) => {
        const next = { ...draft.current, [field]: value }
        draft.current = next; setDocument(next); setStatus('Saving…')
        sessionStorage.setItem(draftKey, JSON.stringify(next))
        localStorage.setItem(draftKey, JSON.stringify(next))
        if (!timer.current) timer.current = setTimeout(() => { timer.current = null; void saveRef.current() }, 5000)
    }, [draftKey])
    const update = useCallback((value: string) => updateField('body', value), [updateField])

    useEffect(() => {
        try {
            const stored = JSON.parse(sessionStorage.getItem(draftKey) || localStorage.getItem(draftKey) || 'null') as StudioDocument | null
            if (canEdit && stored && stored.id === initialDocument.id && typeof stored.body === 'string' && !same(stored, initialDocument)) setRecovery(stored)
        } catch { /* Ignore a damaged browser draft. */ }
    }, [initialDocument, canEdit, draftKey])

    useEffect(() => {
        stopped.current = false
        if (!canEdit) return
        let disposed = false
        saveRef.current = async (keepalive = false) => {
            if (disposed || stopped.current || saving.current || conflictRef.current || same(draft.current, base.current)) return
            const snapshot = { ...draft.current, revision: base.current.revision }
            if (!snapshot.title.trim() || snapshot.title.length > 500 || snapshot.body.length > 1_000_000) { setStatus('Document is too long or has no title'); return }
            saving.current = true
            try {
                const response = await fetch('/api/studio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), keepalive, ...(!keepalive ? { signal: AbortSignal.timeout(15000) } : {}) })
                const next = await response.json() as StudioDocument & { error?: string }
                if (disposed || stopped.current) return
                if (response.status === 409) { conflictRef.current = next; setConflict(next); setStatus('Another tab changed this page'); return }
                if (!response.ok) throw new Error(next.error || 'Save failed')
                base.current = next
                if (same(draft.current, next)) { draft.current = next; setDocument(next); setStatus('Saved'); clearDraft(draftKey, next); if (timer.current) clearTimeout(timer.current); timer.current = null }
                else { setStatus('Saving…'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { timer.current = null; void saveRef.current() }, 50) }
            } catch (error) { if (!disposed && !stopped.current) { setStatus(error instanceof Error ? error.message : 'Save failed'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { timer.current = null; void saveRef.current() }, 3000) } }
            finally { saving.current = false }
        }
        let socket: WebSocket | null = null
        let reconnect: ReturnType<typeof setTimeout> | null = null
        let retry = 1000
        const connect = () => {
            socket = new WebSocket(`${config.url.api_wss}/studio`)
            socket.onopen = () => {
                retry = 1000
                const token = getCookie('access_token') || ''
                void createDeviceProof(token, 'GET', `${config.url.api_wss}/studio`).then(({ proof }) => {
                    if (!disposed && !stopped.current && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'auth', id: getCookie('id') || '', token, dpop: proof }))
                }).catch(() => socket?.close())
            }
            socket.onmessage = event => {
                if (disposed) return
                try {
                    const remote = JSON.parse(event.data) as StudioDocument
                    if ('type' in remote && remote.type === 'pages') { window.dispatchEvent(new Event('studio-pages-updated')); return }
                    if (remote.id !== base.current.id || typeof remote.revision !== 'number' || typeof remote.body !== 'string' || typeof remote.title !== 'string' || remote.revision <= base.current.revision) return
                    if (same(draft.current, remote) || same(draft.current, base.current)) {
                        base.current = remote; draft.current = remote; setDocument(remote); setStatus('Saved'); clearDraft(draftKey, remote); if (timer.current) clearTimeout(timer.current); timer.current = null
                    } else { conflictRef.current = remote; setConflict(remote); setStatus('Another tab changed this page') }
                } catch { /* Ignore malformed messages. */ }
            }
            socket.onclose = () => { if (!disposed && !stopped.current) { reconnect = setTimeout(connect, retry); retry = Math.min(retry * 2, 10000) } }
            socket.onerror = () => socket?.close()
        }
        connect()
        const online = () => { void saveRef.current() }
        const pagehide = () => { if (!same(draft.current, base.current)) void saveRef.current(true) }
        window.addEventListener('online', online)
        window.addEventListener('pagehide', pagehide)
        return () => { if (!same(draft.current, base.current)) void saveRef.current(true); disposed = true; stopped.current = true; if (timer.current) clearTimeout(timer.current); if (reconnect) clearTimeout(reconnect); socket?.close(); window.removeEventListener('online', online); window.removeEventListener('pagehide', pagehide) }
    }, [canEdit, draftKey])

    function resolve(useMine: boolean) {
        if (!conflict) return
        base.current = conflict; conflictRef.current = null; setConflict(null)
        if (!useMine) { const discarded = draft.current; draft.current = conflict; setDocument(conflict); setStatus('Saved'); clearDraft(draftKey, discarded) }
        else { setStatus('Saving…'); void saveRef.current() }
    }

    async function createPage() {
        await saveRef.current()
        if (!same(draft.current, base.current)) return
        try {
            const response = await fetch('/api/studio/pages', { method: 'POST' })
            const page = await response.json() as StudioDocument & { error?: string }
            if (!response.ok || !Number.isSafeInteger(page.id)) throw new Error(page.error || 'Could not create page.')
            window.dispatchEvent(new Event('studio-pages-updated'))
            router.push(`/studio?page=${page.id}`)
        } catch (failure) { setStatus(failure instanceof Error ? failure.message : 'Could not create page.') }
    }

    return <main className='mx-auto max-w-6xl space-y-6 px-4 py-8 text-ui-text md:px-8'>
        <header className='flex flex-wrap items-end justify-between gap-3'>
            <div><p className='text-sm uppercase tracking-wide text-ui-secondary'>Content</p>{canEdit && document.id > 1 && titleEditing
                ? <input autoFocus aria-label='Page name' value={document.title} maxLength={500} onChange={event => updateField('title', event.target.value)} onBlur={() => { if (!document.title.trim()) updateField('title', 'Untitled page'); setTitleEditing(false) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} className='rounded border border-ui-border bg-ui-panel px-2 py-1 text-3xl font-bold' />
                : <h1 className={`text-3xl font-bold ${canEdit && document.id > 1 ? 'cursor-text' : ''}`} onClick={() => { if (canEdit && document.id > 1) setTitleEditing(true) }} title={canEdit && document.id > 1 ? 'Click to rename page' : undefined}>{document.id === 1 ? 'Studio' : document.title}</h1>}</div>
            {canEdit && <div className='flex items-center gap-2'><p role='status' className='text-sm text-ui-secondary'>{status}</p><button type='button' onClick={() => void createPage()} aria-label='Add Studio page' title='Add page' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border hover:bg-ui-panel'><Plus size={18} /></button></div>}
        </header>
        {recovery && <div className='flex flex-wrap items-center gap-3 rounded-lg border border-ui-border p-3'><span>Unsaved draft found in this browser.</span><button className='rounded border border-ui-border px-3 py-1' onClick={() => { draft.current = recovery; setDocument(recovery); setRecovery(null); setStatus('Saving…'); void saveRef.current() }}>Restore draft</button><button className='rounded border border-ui-border px-3 py-1' onClick={() => { clearDraft(draftKey, recovery); setRecovery(null) }}>Discard</button></div>}
        {conflict && <div role='alert' className='flex flex-wrap items-center gap-3 rounded-lg border border-ui-border p-3'><span>Another tab updated Studio. Choose which version to keep.</span><button className='rounded border border-ui-border px-3 py-1' onClick={() => resolve(true)}>Use my draft</button><button className='rounded border border-ui-border px-3 py-1' onClick={() => resolve(false)}>Use latest version</button></div>}
        <MarkdownDocumentEditor value={document.body} onChange={update} uploadImage={file => uploadMarkdownImage(file, true)} disabled={!canEdit} />
    </main>
}
