import Link from 'next/link'
import { MessageCircle, Send } from 'lucide-react'
import type { RefObject, FormEvent } from 'react'
import SupportFeedback, { SupportStars } from './supportFeedback'
import { supportFieldClass } from './supportChatStyles'
import type { Message, Ticket } from './supportChatTypes'

export function SupportConversation({
    embedded, tickets, isSupport, selectedId, selected, selectChat, statusChange, updatingStatus, sending,
    updateStatus, log, messages, userId, connection, error, statusError, sendFeedback, input, setInput,
    subject, setSubject, loading, send,
}: {
    embedded: boolean
    tickets: Ticket[]
    isSupport: boolean
    selectedId: string
    selected?: Ticket
    selectChat: (id: string) => void
    statusChange: { id: string; status: 'open' | 'closed' } | null
    updatingStatus: boolean
    sending: boolean
    updateStatus: (status: 'open' | 'closed') => void
    log: RefObject<HTMLDivElement | null>
    messages: Message[]
    userId: string
    connection: string
    error: string
    statusError: { id: string; message: string } | null
    sendFeedback: (rating: number, comment: string) => Promise<void>
    input: string
    setInput: (value: string) => void
    subject: string
    setSubject: (value: string) => void
    loading: boolean
    send: (event: FormEvent<HTMLFormElement>) => void
}) {
    return <>
        {!embedded ? <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
            {tickets.length ? <label className='grid gap-1.5 text-xs text-ui-muted'>Conversation<select aria-label='Conversation' value={selectedId} onChange={event => selectChat(event.target.value)} className={supportFieldClass}>{tickets.map(ticket => <option key={ticket.id} value={ticket.id}>{isSupport && ticket.user_name ? `${ticket.user_name} — ` : ''}{ticket.subject}</option>)}</select></label> : <p className='text-xs text-ui-muted'>Account, billing, or product questions? Talk to our support team.</p>}
        </div> : null}
        <div className='grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]'>
            <header className='flex min-h-20 items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div className='grid min-w-0 gap-1'>
                    <h2 className='truncate text-sm font-semibold text-ui-text'>{selected?.subject || (isSupport ? 'Customer conversation' : 'Start a support chat')}</h2>
                    <p className='text-xs text-ui-muted'>{selected ? selected.status === 'closed' ? 'Chat resolved' : selected.agent_name ? `Speaking with ${selected.agent_name}` : 'Waiting for support.' : isSupport ? 'Choose a conversation from the queue.' : 'Tell us what you need help with.'}</p>
                </div>
                {isSupport && selected ? <div className='flex shrink-0 items-center gap-2'>{statusChange?.id === selectedId ? <span role='status' className='text-xs text-ui-muted'>Saving…</span> : null}<button type='button' disabled={updatingStatus || sending} onClick={() => updateStatus(selected.status === 'closed' ? 'open' : 'closed')} className='shrink-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-medium text-ui-text hover:bg-ui-raised disabled:opacity-50'>{selected.status === 'closed' ? 'Reopen chat' : 'Resolve'}</button></div> : null}
            </header>
            <div ref={log} role='log' aria-label='Messages' className='min-h-0 overflow-y-auto p-4'>
                {isSupport && selected?.feedback_rating ? <section aria-label='Customer feedback' className='mb-4 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'><h3 className='text-xs font-semibold text-ui-text'>Customer feedback</h3><SupportStars rating={selected.feedback_rating} />{selected.feedback_comment ? <p className='whitespace-pre-wrap text-sm text-ui-text [overflow-wrap:anywhere]'>{selected.feedback_comment}</p> : null}</section> : null}
                {messages.length ? <div className='grid gap-3'>{messages.map(message => message.sender_kind === 'system' ? <p key={message.id} className='px-3 py-1 text-center text-xs leading-5 text-ui-muted'>{message.body}</p> : <div key={message.id} className={`min-w-0 max-w-[90%] rounded-lg px-3 py-2 text-sm text-ui-text ${message.sender_id === userId ? 'justify-self-end bg-ui-primary/10' : 'justify-self-start bg-ui-raised'}`}><p className='text-xs font-semibold text-ui-muted'>{message.sender_name}</p><p className='mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]'>{message.body}</p></div>)}</div> : <div className='grid h-full content-center justify-items-center gap-3 text-center text-sm text-ui-muted'><MessageCircle aria-hidden='true' className='h-8 w-8 text-ui-muted' /><p>{isSupport ? 'Select a customer chat to read and reply.' : 'Your conversation starts here.'}</p></div>}
            </div>
            <div className='border-t border-ui-border p-4'>
                {!error && connection === 'reconnecting' ? <p role='status' className='mb-2 text-xs text-ui-muted'>Reconnecting…</p> : null}
                {error ? <p role='alert' className='mb-3 text-sm text-ui-text'>{error}</p> : null}
                {statusError?.id === selectedId ? <p role='alert' className='mb-3 text-sm text-ui-text'>{statusError.message}</p> : null}
                {selected?.status === 'closed' ? isSupport ? <p className='text-xs text-ui-muted'>Chat resolved. Reopen it to continue the conversation.</p> : <SupportFeedback key={`${selectedId}:${selected.resolution_version}`} feedback={selected} submit={sendFeedback} /> : !isSupport || selectedId ? (
                    <form onSubmit={send} className='grid min-w-0 gap-3'>
                        {!selectedId ? <input aria-label='Subject' maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} placeholder='Subject' className={`h-10 ${supportFieldClass}`} /> : null}
                        <div className='flex min-w-0 items-end gap-2'>
                            <textarea aria-label='Message' rows={2} maxLength={10000} disabled={sending || loading || updatingStatus} value={input} onChange={event => setInput(event.target.value)} placeholder='Write a message…' className={`max-h-32 min-h-20 flex-1 resize-y disabled:opacity-60 ${supportFieldClass}`} />
                            <button type='submit' disabled={sending || loading || updatingStatus || !input.trim()} className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:cursor-not-allowed disabled:opacity-50'><Send aria-hidden='true' className='h-4 w-4' />{sending ? 'Sending…' : 'Send'}</button>
                        </div>
                    </form>
                ) : <p className='text-xs text-ui-muted'>Select a conversation to reply.</p>}
                {!embedded ? <Link href='/support' className='mt-3 block text-center text-xs text-ui-primary hover:underline'>Open full support page</Link> : null}
            </div>
        </div>
    </>
}
