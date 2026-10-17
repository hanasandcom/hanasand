'use client'

import { ArrowUp, ImageIcon, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { PromptPortalItem, PromptPortalPublicState } from '@/utils/promptPortal/store'
import { comparePromptItems } from '@/utils/promptPortal/ordering'
import { PromptQueue } from './PromptQueue'

const emptyState: PromptPortalPublicState = {
    items: [],
}

export default function PromptPortalClient({ initialState = emptyState }: { initialState?: PromptPortalPublicState }) {
    const [state, setState] = useState<PromptPortalPublicState>(initialState)
    const [prompt, setPrompt] = useState('')
    const [priority, setPriority] = useState<'now' | 'next'>('next')
    const [files, setFiles] = useState<FileList | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const pending = useMemo(() => state.items
        .filter(item => item.status === 'queued' || item.status === 'running')
        .sort(comparePromptItems), [state.items])
    const completed = useMemo(() => state.items.filter(item => item.status === 'done' || item.status === 'error'), [state.items])

    useEffect(() => {
        void refresh()
        const interval = window.setInterval(refresh, 4000)
        return () => window.clearInterval(interval)
    }, [])

    async function refresh() {
        const response = await fetch('/api/prompt', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (payload?.items) setState(payload)
    }

    async function enqueue(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')
        const form = new FormData()
        form.set('prompt', prompt)
        form.set('priority', priority)
        Array.from(files || []).forEach(file => form.append('files', file))
        const response = await fetch('/api/prompt', { method: 'POST', body: form })
        const payload = await response.json().catch(() => null)
        setBusy(false)
        if (!response.ok) return setError(payload?.error || 'Unable to queue prompt.')
        setPrompt('')
        setFiles(null)
        const input = document.getElementById('prompt-files') as HTMLInputElement | null
        if (input) input.value = ''
        setState(payload)
    }

    async function mutateQueued(action: 'edit' | 'delete' | 'reorder', item: PromptPortalItem, extra: Record<string, unknown> = {}) {
        setBusy(true)
        setError('')
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action, id: item.id, ...extra }),
        })
        const payload = await response.json().catch(() => null)
        setBusy(false)
        if (!response.ok) return setError(payload?.error || 'Unable to update queue.')
        setState(payload)
    }

    function editQueued(item: PromptPortalItem) {
        const next = window.prompt('Edit instruction', item.prompt)
        if (next !== null) void mutateQueued('edit', item, { prompt: next })
    }

    return (
        <main className='min-h-app-viewport bg-ui-canvas px-4 py-6 text-ui-text md:px-8'>
            <div className='mx-auto grid max-w-6xl gap-4'>
                <header className='flex flex-col gap-3 border-b border-ui-border pb-4 md:flex-row md:items-end md:justify-between'>
                    <div>
                        <p className='text-xs font-semibold uppercase tracking-[0.16em] text-ui-primary'>Remote access</p>
                        <h1 className='mt-2 text-3xl font-semibold tracking-normal'>Prompt</h1>
                    </div>
                    <div className='inline-flex h-9 items-center gap-2 self-start rounded-lg border border-ui-success/35 bg-ui-success/10 px-3 text-sm font-semibold text-ui-success'>
                        <ShieldCheck className='h-4 w-4' />
                        Active
                    </div>
                </header>

                {error ? <p className='rounded-lg border border-ui-danger/30 bg-ui-raised/10 px-3 py-2 text-sm font-semibold text-ui-text'>{error}</p> : null}

                <section className='grid gap-4 lg:max-h-[calc(100vh-13rem)] lg:grid-cols-3 lg:overflow-hidden'>
                    <form onSubmit={enqueue} className='grid min-h-0 gap-3 overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-4'>
                        <div className='flex items-center justify-between gap-2'>
                            <h2 className='text-sm font-semibold'>New instruction</h2>
                            <button type='button' onClick={refresh} className='inline-flex h-8 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-xs font-semibold text-ui-muted hover:text-ui-text'>
                                <RefreshCw className='h-3.5 w-3.5' />
                                Refresh
                            </button>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={event => setPrompt(event.target.value)}
                            rows={9}
                            className='min-h-44 resize-y rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm leading-6 outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/25'
                            placeholder='Write the next instruction.'
                        />
                        <div className='flex flex-wrap items-center gap-2'>
                            <button type='button' onClick={() => setPriority('next')} className={priority === 'next' ? selectedButton : plainButton}>Next</button>
                            <button type='button' onClick={() => setPriority('now')} className={priority === 'now' ? selectedButton : plainButton}>
                                <ArrowUp className='h-3.5 w-3.5' />
                                Now
                            </button>
                            <label className='inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted hover:text-ui-text'>
                                <ImageIcon className='h-4 w-4' />
                                Images
                                <input id='prompt-files' type='file' accept='image/*' multiple onChange={event => setFiles(event.target.files)} className='sr-only' />
                            </label>
                            {files?.length ? <span className='text-xs font-semibold text-ui-muted'>{files.length} selected</span> : null}
                        </div>
                        <button disabled={busy || !prompt.trim()} className='ui-button ui-button-primary h-10 px-4 text-sm disabled:cursor-not-allowed'>
                            <Send className='h-4 w-4' />
                            Send
                        </button>
                    </form>

                    <PromptQueue
                        title='Input queue'
                        items={pending}
                        empty='No queued instructions.'
                        onEdit={editQueued}
                        onDelete={item => mutateQueued('delete', item)}
                        onMove={(item, direction) => mutateQueued('reorder', item, { direction })}
                    />
                    <PromptQueue title='Output queue' items={completed} empty='No completed results yet.' />
                </section>
            </div>
        </main>
    )
}

const plainButton = 'inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted hover:text-ui-text'
const selectedButton = 'inline-flex h-9 items-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-sm font-semibold text-ui-on-primary'
