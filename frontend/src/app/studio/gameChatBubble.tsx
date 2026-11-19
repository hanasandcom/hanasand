'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe2, MessageCircle, X } from 'lucide-react'
import Link from 'next/link'

type Message = { id: number; name: string; body: string; source: 'game' | 'web'; created_at: string }

export default function GameChatBubble() {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [draft, setDraft] = useState('')
    const [error, setError] = useState('')
    const [linkStatus, setLinkStatus] = useState('')
    const [canSend, setCanSend] = useState(false)
    const cursor = useRef(0)
    useEffect(() => {
        const code = new URLSearchParams(window.location.search).get('game_link')
        if (!code) return
        void fetch('/api/game-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
            .then(async response => {
                if (response.status === 401) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
                if (!response.ok) throw new Error((await response.json() as { error?: string }).error || 'Could not link account.')
                setLinkStatus('Game account linked. Return to the game to continue.')
                window.history.replaceState(null, '', window.location.pathname)
            }).catch(failure => setLinkStatus(failure instanceof Error ? failure.message : 'Could not link account.'))
    }, [])
    useEffect(() => {
        let active = true
        async function load() {
            try {
                const response = await fetch(`/api/game-chat?after=${cursor.current}`, { cache: 'no-store' })
                if (!response.ok) throw new Error('Chat is temporarily unavailable.')
                const incoming = await response.json() as Message[]
                if (!active) return
                setCanSend(response.headers.get('x-game-chat-can-send') === '1')
                if (incoming.length) {
                    cursor.current = Math.max(cursor.current, ...incoming.map(message => message.id))
                    setMessages(previous => [...previous, ...incoming].slice(-80))
                }
                setError('')
            } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'Could not load chat.') }
        }
        void load()
        const timer = setInterval(() => { void load() }, 1500)
        return () => { active = false; clearInterval(timer) }
    }, [])
    async function send() {
        const message = draft.trim()
        if (!message) return
        try {
            const response = await fetch('/api/game-chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) })
            if (response.status === 401) { setCanSend(false); return }
            if (!response.ok) throw new Error('Could not send message.')
            setDraft('');setError('')
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not send message.') }
    }
    return <div className='fixed bottom-5 right-5 z-[1100] text-ui-text'>
        {linkStatus && <p role='status' className='mb-2 max-w-80 rounded-xl border border-ui-border bg-ui-panel p-3 text-sm shadow-ui-panel'>{linkStatus}</p>}
        {open && <section role='dialog' aria-label='World chat' className='mb-3 flex h-[min(32rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-ui-panel'>
            <header className='flex items-center justify-between border-b border-ui-border px-4 py-3'><strong className='text-sm'>World chat</strong><button type='button' aria-label='Close world chat' onClick={() => setOpen(false)}><X className='h-5 w-5' /></button></header>
            <div aria-live='polite' className='flex-1 space-y-2 overflow-y-auto p-4 text-sm'>{messages.map(message => <p key={message.id}>{message.source === 'web' && <span tabIndex={0} title='This message was sent from the website chat.' aria-label='Sent from website chat' className='mr-1 inline-flex align-middle'><Globe2 aria-hidden='true' className='h-3.5 w-3.5' /></span>}<strong>{message.name}</strong> {message.body}</p>)}</div>
            {error && <p role='status' className='px-4 text-xs text-ui-danger'>{error}</p>}
            {canSend ? <form onSubmit={event => { event.preventDefault();void send() }} className='flex gap-2 border-t border-ui-border p-3'><input aria-label='Message the world' value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} className='min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm' /><button type='submit' className='rounded-lg bg-ui-primary px-3 py-2 text-sm text-ui-on-primary'>Send</button></form>
                : <p className='border-t border-ui-border px-4 py-4 text-sm'><Link href='/login?path=%2Fstudio' className='text-blue-400 hover:underline focus-visible:underline'>Sign in</Link> to use world chat.</p>}
        </section>}
        <button type='button' onClick={() => setOpen(value => !value)} aria-label={open ? 'Close world chat' : 'Open world chat'} className='ml-auto grid h-14 w-14 place-items-center rounded-full bg-ui-primary text-ui-on-primary shadow-ui-panel'><MessageCircle className='h-6 w-6' /></button>
    </div>
}
