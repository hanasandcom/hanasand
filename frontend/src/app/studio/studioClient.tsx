'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { createDeviceProof } from '@/utils/auth/deviceProof'
import type { StudioDocument } from '@/utils/studio'
import MarkdownDocumentEditor from '@/components/markdown/MarkdownDocumentEditor'
import uploadMarkdownImage from '@/components/markdown/uploadMarkdownImage'

const DRAFT_KEY = 'hanasand-studio-draft'
const same = (a: StudioDocument, b: StudioDocument) => a.title === b.title && a.body === b.body

export default function StudioClient({ initialDocument }: { initialDocument: StudioDocument }) {
    const [document, setDocument] = useState(initialDocument)
    const [status, setStatus] = useState('Saved')
    const [conflict, setConflict] = useState<StudioDocument | null>(null)
    const [recovery, setRecovery] = useState<StudioDocument | null>(null)
    const draft = useRef(initialDocument)
    const base = useRef(initialDocument)
    const conflictRef = useRef<StudioDocument | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saving = useRef(false)
    const stopped = useRef(false)
    const saveRef = useRef<() => Promise<void>>(async () => {})

    const update = useCallback((field: 'title' | 'body', value: string) => {
        const next = { ...draft.current, [field]: value }
        draft.current = next; setDocument(next); setStatus('Saving…')
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { void saveRef.current() }, 650)
    }, [])

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as StudioDocument | null
            if (stored && typeof stored.body === 'string' && typeof stored.title === 'string' && !same(stored, initialDocument)) setRecovery(stored)
        } catch { /* Ignore a damaged browser draft. */ }
    }, [initialDocument])

    useEffect(() => {
        stopped.current = false
        let disposed = false
        saveRef.current = async () => {
            if (disposed || stopped.current || saving.current || conflictRef.current || same(draft.current, base.current)) return
            const snapshot = { ...draft.current, revision: base.current.revision }
            if (!snapshot.title.trim() || snapshot.title.length > 500 || snapshot.body.length > 1_000_000) { setStatus('Document is too long or has no title'); return }
            saving.current = true
            try {
                const response = await fetch('/api/studio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), signal: AbortSignal.timeout(15000) })
                const next = await response.json() as StudioDocument & { error?: string }
                if (disposed || stopped.current) return
                if (response.status === 409) { conflictRef.current = next; setConflict(next); setStatus('Another tab changed this page'); return }
                if (!response.ok) throw new Error(next.error || 'Save failed')
                base.current = next
                if (same(draft.current, next)) { draft.current = next; setDocument(next); setStatus('Saved'); localStorage.removeItem(DRAFT_KEY) }
                else { setStatus('Saving…'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveRef.current() }, 50) }
            } catch (error) { if (!disposed && !stopped.current) { setStatus(error instanceof Error ? error.message : 'Save failed'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveRef.current() }, 3000) } }
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
                    if (typeof remote.revision !== 'number' || typeof remote.body !== 'string' || typeof remote.title !== 'string' || remote.revision <= base.current.revision) return
                    if (same(draft.current, remote) || same(draft.current, base.current)) {
                        base.current = remote; draft.current = remote; setDocument(remote); setStatus('Saved'); localStorage.removeItem(DRAFT_KEY)
                    } else { conflictRef.current = remote; setConflict(remote); setStatus('Another tab changed this page') }
                } catch { /* Ignore malformed messages. */ }
            }
            socket.onclose = () => { if (!disposed && !stopped.current) { reconnect = setTimeout(connect, retry); retry = Math.min(retry * 2, 10000) } }
            socket.onerror = () => socket?.close()
        }
        connect()
        const online = () => { void saveRef.current() }
        const pagehide = () => { if (!same(draft.current, base.current)) void saveRef.current() }
        window.addEventListener('online', online)
        window.addEventListener('pagehide', pagehide)
        return () => { disposed = true; stopped.current = true; if (timer.current) clearTimeout(timer.current); if (reconnect) clearTimeout(reconnect); socket?.close(); window.removeEventListener('online', online); window.removeEventListener('pagehide', pagehide) }
    }, [])

    function resolve(useMine: boolean) {
        if (!conflict) return
        base.current = conflict; conflictRef.current = null; setConflict(null)
        if (!useMine) { draft.current = conflict; setDocument(conflict); setStatus('Saved'); localStorage.removeItem(DRAFT_KEY) }
        else { setStatus('Saving…'); void saveRef.current() }
    }

    return <main className='mx-auto max-w-6xl space-y-6 px-4 py-8 text-ui-text md:px-8'>
        <header className='flex flex-wrap items-end justify-between gap-3'>
            <div><p className='text-sm uppercase tracking-wide text-ui-secondary'>Content</p><h1 className='text-3xl font-bold'>Studio</h1></div>
            <p role='status' className='text-sm text-ui-secondary'>{status}</p>
        </header>
        {recovery && <div className='flex flex-wrap items-center gap-3 rounded-lg border border-ui-border p-3'><span>Unsaved draft found in this browser.</span><button className='rounded border border-ui-border px-3 py-1' onClick={() => { draft.current = recovery; setDocument(recovery); setRecovery(null); setStatus('Saving…'); void saveRef.current() }}>Restore draft</button><button className='rounded border border-ui-border px-3 py-1' onClick={() => { localStorage.removeItem(DRAFT_KEY); setRecovery(null) }}>Discard</button></div>}
        {conflict && <div role='alert' className='flex flex-wrap items-center gap-3 rounded-lg border border-ui-border p-3'><span>Another tab updated Studio. Choose which version to keep.</span><button className='rounded border border-ui-border px-3 py-1' onClick={() => resolve(true)}>Use my draft</button><button className='rounded border border-ui-border px-3 py-1' onClick={() => resolve(false)}>Use latest version</button></div>}
        <label className='grid gap-2 font-semibold'>Page title<input value={document.title} onChange={event => update('title', event.target.value)} maxLength={500} className='rounded-lg border border-ui-border bg-ui-panel px-4 py-3 font-normal' /></label>
        <MarkdownDocumentEditor value={document.body} onChange={value => update('body', value)} uploadImage={uploadMarkdownImage} />
    </main>
}
