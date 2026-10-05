'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'

type Address = { email: string, name?: string }
type MessageSummary = {
    id: string
    subject: string
    preview: string
    receivedAt: string
    from: Address[]
    to: Address[]
    hasAttachment: boolean
    isRead: boolean
    isFlagged: boolean
}
type Message = MessageSummary & { textBody: string, htmlBody: string }
type Mailbox = { id: string, name: string, role?: string, unreadEmails?: number }
type Overview = {
    mailboxUser: string
    mailboxAddress: string
    accessibleAccounts: Array<{ id: string, name: string, address: string }>
    mailboxes: Mailbox[]
    selectedMailboxId: string | null
    messages: MessageSummary[]
    selectedMessage: Message | null
    nextCursor?: string | null
    actor?: { canSend?: boolean }
}

const API = 'https://mail.hanasand.com/api/backend'

export default function MailClient({ mailboxUser }: { mailboxUser: string | null }) {
    const [overview, setOverview] = useState<Overview | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [compose, setCompose] = useState(false)
    const [to, setTo] = useState('')
    const [subject, setSubject] = useState('')
    const [body, setBody] = useState('')
    const [search, setSearch] = useState('')

    const request = useCallback(async (path: string, init: RequestInit = {}) => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            window.location.assign('/logout?path=/login%3Fpath%3D/mail%26expired=true')
            throw new Error('Your session has expired.')
        }
        const response = await fetch(`${API}${path}`, {
            ...init,
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', id, Authorization: `Bearer ${token}` },
        })
        const payload = await response.json().catch(() => ({}))
        if (response.status === 401) {
            window.location.assign('/logout?path=/login%3Fpath%3D/mail%26expired=true')
            throw new Error('Your session has expired.')
        }
        if (!response.ok) throw new Error(payload?.error || 'Mail is unavailable right now.')
        return payload
    }, [])

    const load = useCallback(async (messageId?: string | null, mailboxId?: string | null) => {
        setLoading(true)
        setError('')
        try {
            const query = new URLSearchParams()
            if (mailboxUser) query.set('mailboxUser', mailboxUser)
            if (mailboxId) query.set('mailboxId', mailboxId)
            if (messageId) query.set('messageId', messageId)
            const payload = await request(`/mail/overview?${query}`) as Overview
            setOverview(payload)
            setSelectedId(payload.selectedMessage?.id || payload.messages[0]?.id || null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to load mail.')
        } finally {
            setLoading(false)
        }
    }, [mailboxUser, request])

    useEffect(() => { void load() }, [load])

    const visibleMessages = useMemo(() => {
        const term = search.trim().toLocaleLowerCase()
        if (!term) return overview?.messages || []
        return (overview?.messages || []).filter(message =>
            [message.subject, message.preview, ...message.from.map(address => address.name || address.email)].join(' ').toLocaleLowerCase().includes(term)
        )
    }, [overview, search])

    const selectMessage = async (message: MessageSummary) => {
        setSelectedId(message.id)
        if (overview?.selectedMessage?.id === message.id) return
        setLoading(true)
        setError('')
        try {
            const query = new URLSearchParams({ messageId: message.id })
            if (mailboxUser) query.set('mailboxUser', mailboxUser)
            if (overview?.selectedMailboxId) query.set('mailboxId', overview.selectedMailboxId)
            const payload = await request(`/mail/overview?${query}`) as Overview
            setOverview(current => current ? { ...current, ...payload } : payload)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to open message.')
        } finally {
            setLoading(false)
        }
    }

    const action = async (message: MessageSummary, actionName: 'read' | 'unread' | 'archive') => {
        setBusy(true)
        setError('')
        try {
            await request(`/mail/message/${encodeURIComponent(message.id)}/action`, {
                method: 'POST',
                body: JSON.stringify({ mailboxUser, action: actionName }),
            })
            await load(null, overview?.selectedMailboxId)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update message.')
        } finally {
            setBusy(false)
        }
    }

    const send = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setBusy(true)
        setError('')
        try {
            await request('/mail/send', {
                method: 'POST',
                body: JSON.stringify({ mailboxUser, to, subject, textBody: body }),
            })
            setCompose(false)
            setTo('')
            setSubject('')
            setBody('')
            await load(null, overview?.selectedMailboxId)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to send message.')
        } finally {
            setBusy(false)
        }
    }

    const activeMessage = overview?.selectedMessage?.id === selectedId ? overview.selectedMessage : null
    const mailbox = overview?.mailboxes.find(item => item.id === overview.selectedMailboxId)

    return (
        <section className='mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <p className='text-sm text-slate-400'>{overview?.mailboxAddress || 'Your mailbox'}</p>
                    {mailboxUser && <p className='text-xs text-slate-500'>Viewing {mailboxUser}</p>}
                </div>
                <div className='flex items-center gap-2'>
                    <a href='https://mail.hanasand.com/' className='rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5'>Backup mail UI</a>
                    {overview?.actor?.canSend !== false && <button onClick={() => setCompose(true)} className='rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300'>Compose</button>}
                </div>
            </div>

            {error && <div role='alert' className='mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200'>{error}</div>}
            <div className='grid min-h-[600px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 lg:grid-cols-[280px_minmax(0,1fr)]'>
                <aside className='border-b border-white/10 lg:border-b-0 lg:border-r'>
                    {overview && overview.accessibleAccounts.length > 1 && <label className='block border-b border-white/10 p-3'>
                        <span className='sr-only'>Mailbox account</span>
                        <select value={overview.mailboxUser} onChange={event => { const value = event.target.value; window.location.href = value === getCookie('id') ? '/mail' : `/mail?mailboxUser=${encodeURIComponent(value)}` }} className='w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200'>
                            {overview.accessibleAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.address}</option>)}
                        </select>
                    </label>}
                    <nav aria-label='Mail folders' className='flex gap-2 overflow-x-auto border-b border-white/10 p-3 lg:flex-col lg:border-0'>
                        {(overview?.mailboxes || []).map(item => <button key={item.id} onClick={() => void load(null, item.id)} className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${item.id === overview?.selectedMailboxId ? 'bg-cyan-300/10 text-cyan-200' : 'text-slate-300 hover:bg-white/5'}`}>
                            <span>{item.name}</span>{item.unreadEmails ? <span className='rounded-full bg-white/10 px-2 py-0.5 text-xs'>{item.unreadEmails}</span> : null}
                        </button>)}
                    </nav>
                </aside>

                <div className='grid min-w-0 lg:grid-cols-[minmax(260px,36%)_minmax(0,1fr)]'>
                    <section className='min-w-0 border-b border-white/10 lg:border-b-0 lg:border-r' aria-label={`${mailbox?.name || 'Mail'} messages`}>
                        <div className='border-b border-white/10 p-3'>
                            <input value={search} onChange={event => setSearch(event.target.value)} placeholder='Search this folder' aria-label='Search messages' className='w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none' />
                        </div>
                        <div className='max-h-[620px] overflow-y-auto'>
                            {loading && <p className='p-5 text-sm text-slate-400'>Loading mail…</p>}
                            {!loading && visibleMessages.length === 0 && <p className='p-5 text-sm text-slate-400'>No messages in this folder.</p>}
                            {visibleMessages.map(message => <button key={message.id} onClick={() => void selectMessage(message)} className={`block w-full border-b border-white/5 px-4 py-3 text-left hover:bg-white/5 ${message.id === selectedId ? 'bg-white/5' : ''}`}>
                                <span className='flex items-center justify-between gap-2'>
                                    <span className={`truncate text-sm ${message.isRead ? 'text-slate-300' : 'font-semibold text-white'}`}>{message.from[0]?.name || message.from[0]?.email || 'Unknown sender'}</span>
                                    {!message.isRead && <span className='h-2 w-2 shrink-0 rounded-full bg-cyan-300' aria-label='Unread' />}
                                </span>
                                <span className={`mt-1 block truncate text-sm ${message.isRead ? 'text-slate-400' : 'text-slate-200'}`}>{message.subject || '(no subject)'}</span>
                                <span className='mt-1 block line-clamp-2 text-xs text-slate-500'>{message.preview}</span>
                            </button>)}
                        </div>
                    </section>

                    <article className='min-w-0 p-5 sm:p-7'>
                        {!activeMessage && <div className='flex h-full min-h-56 items-center justify-center text-center text-sm text-slate-500'>{loading ? 'Loading message…' : 'Choose a message to read.'}</div>}
                        {activeMessage && <>
                            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-5'>
                                <div className='min-w-0'><h2 className='wrap-break-word text-xl font-semibold text-white'>{activeMessage.subject || '(no subject)'}</h2><p className='mt-2 text-sm text-slate-400'>From {activeMessage.from.map(address => address.name ? `${address.name} <${address.email}>` : address.email).join(', ')}</p><p className='mt-1 text-xs text-slate-500'>To {activeMessage.to.map(address => address.email).join(', ')}</p></div>
                                <div className='flex shrink-0 gap-2'>
                                    <button disabled={busy} onClick={() => void action(activeMessage, activeMessage.isRead ? 'unread' : 'read')} className='rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5'>{activeMessage.isRead ? 'Mark unread' : 'Mark read'}</button>
                                    <button disabled={busy} onClick={() => void action(activeMessage, 'archive')} className='rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5'>Archive</button>
                                </div>
                            </div>
                            <pre className='whitespace-pre-wrap wrap-break-word pt-5 font-sans text-sm leading-6 text-slate-200'>{activeMessage.textBody || activeMessage.preview || 'This message has no plain-text body.'}</pre>
                        </>}
                    </article>
                </div>
            </div>

            {compose && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4' role='presentation' onMouseDown={event => { if (event.target === event.currentTarget) setCompose(false) }}>
                <form onSubmit={send} className='w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl'>
                    <div className='mb-4 flex items-center justify-between'><h2 className='text-lg font-semibold text-white'>New message</h2><button type='button' onClick={() => setCompose(false)} className='text-slate-400 hover:text-white' aria-label='Close'>✕</button></div>
                    <label className='mb-3 block text-sm text-slate-300'>To<input required type='email' value={to} onChange={event => setTo(event.target.value)} className='mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white' /></label>
                    <label className='mb-3 block text-sm text-slate-300'>Subject<input value={subject} onChange={event => setSubject(event.target.value)} className='mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white' /></label>
                    <label className='mb-4 block text-sm text-slate-300'>Message<textarea required rows={9} value={body} onChange={event => setBody(event.target.value)} className='mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white' /></label>
                    <div className='flex justify-end gap-2'><button type='button' onClick={() => setCompose(false)} className='rounded-lg px-4 py-2 text-sm text-slate-300'>Cancel</button><button disabled={busy} className='rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50'>{busy ? 'Sending…' : 'Send'}</button></div>
                </form>
            </div>}
        </section>
    )
}
