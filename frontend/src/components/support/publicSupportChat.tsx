'use client'

import { ArrowUp, LoaderCircle, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GuestSupportFeedback } from './supportFeedback'
import type { PublicSupportChatOptions, PublicSupportConversation, PublicSupportMessage } from './publicSupportChatTypes'
import { usePublicSupportChat } from './usePublicSupportChat'

export type { PublicSupportConversation } from './publicSupportChatTypes'

// Render only same-site links from the assistant, never HTML or arbitrary model URLs.
function MessageBody({ text }: { text: string }) {
    return <p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{text.split(/(\[[^\]]+\]\(\/[^\s)]*\))/g).map((part, index) => {
        const match = /^\[([^\]]+)\]\((\/[^\s)]*)\)$/.exec(part)
        return match && !match[2].startsWith('//') && !match[2].includes('\\') ? <a key={index} href={match[2]} className='font-medium underline underline-offset-2'>{match[1]}</a> : part
    })}</p>
}

function ConversationMessages({ messages }: { messages: PublicSupportMessage[] }) {
    return <>{messages.map(message => message.sender_kind === 'system'
        ? <p key={message.id} className='px-2 py-1 text-center text-xs leading-5 text-ui-muted'>{message.body}</p>
        : <div key={message.id} className={`min-w-0 max-w-[92%] ${message.sender_kind === 'user' ? 'justify-self-end' : 'justify-self-start'}`}>
            <p className={`mb-1.5 text-[11px] font-medium text-ui-muted ${message.sender_kind === 'user' ? 'text-right' : ''}`}>{message.sender_name}</p>
            <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.sender_kind === 'user' ? 'rounded-tr-md bg-ui-primary text-ui-on-primary' : 'rounded-tl-md bg-ui-raised text-ui-text'}`}><MessageBody text={message.body} /></div>
        </div>)}</>
}

export default function PublicSupportChat(props: PublicSupportChatOptions) {
    const chat = usePublicSupportChat(props)
    const {
        selectedId, conversation, viewingClosedChat, setViewingClosedChat, input, setInput, loading,
        sending, transferring, closing, error, refreshError, connection, human, agentName, busy,
        retryable, visibleMessages, log, closedLog, legacy, submit, send, startNewChat, endConversation,
        sendFeedback, sendCloseFeedback,
    } = chat
    useEffect(() => {
        props.onAssistantStateChange?.(human, agentName)
    }, [agentName, human, props.onAssistantStateChange])
    useEffect(() => {
        props.registerNewChatAction?.(startNewChat)
        return () => props.registerNewChatAction?.(null)
    }, [props.registerNewChatAction, startNewChat])
    const supportMaintenance = error === 'Support is being updated. Please retry shortly.'
    if (conversation.status === 'closed') return <section aria-label={viewingClosedChat ? 'Support chat' : 'Support feedback'} className='min-h-0 min-w-0'>
        <div className={viewingClosedChat ? 'grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]' : 'hidden'}>
            <header className='flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-5 py-3'>
                <div className='min-w-0'><h1 className='text-sm font-semibold text-ui-text'>Support</h1><p className='text-xs text-ui-muted'>Chat resolved</p></div>
                <div className='flex min-w-0 flex-wrap justify-end gap-2'>
                    <button type='button' onClick={() => { setViewingClosedChat(false); props.onResolvedChange?.(true) }} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition-colors hover:bg-ui-canvas'>Back to feedback</button>
                    <button type='button' onClick={startNewChat} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text transition-colors hover:bg-ui-canvas'>New chat</button>
                </div>
            </header>
            <div ref={closedLog} role='log' aria-label='Messages' className='min-h-0 overflow-y-auto overscroll-contain px-5 py-5'>
                {visibleMessages.length ? <div className='grid gap-4'><ConversationMessages messages={visibleMessages} /></div> : <p className='text-center text-sm text-ui-muted'>No messages in this chat.</p>}
            </div>
        </div>
        <div className={viewingClosedChat ? 'hidden' : 'grid justify-items-center gap-5 py-2'}>
            <GuestSupportFeedback key={`${selectedId}:${conversation.resolution_version}`} feedback={conversation} submit={sendFeedback} submitCloseFeedback={sendCloseFeedback} onNewChat={startNewChat} onViewChat={() => { setViewingClosedChat(true); props.onResolvedChange?.(false) }} />
        </div>
    </section>
    return (
        <section aria-label='Support chat' className='grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]'>
            {!legacy ? props.hideNewChatButton && !conversation.id ? null : <div className='flex min-w-0 items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-5 py-3'>
                {!props.hideNewChatButton ? <h1 className='text-sm font-semibold text-ui-text'>Support</h1> : null}
                <div className='flex shrink-0 items-center gap-2'>
                    {!props.hideNewChatButton ? <button type='button' onClick={startNewChat} className='rounded-lg border border-ui-border bg-ui-panel px-3.5 py-2 text-xs font-semibold text-ui-text transition-colors hover:bg-ui-canvas'>New chat</button> : null}
                    {conversation.id ? <button type='button' disabled={closing || sending || transferring} onClick={() => void endConversation()} className='rounded-lg border border-ui-border bg-ui-panel px-3.5 py-2 text-xs font-semibold text-ui-text transition-colors hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-50'>{closing ? <span className='inline-flex items-center gap-1.5'><LoaderCircle className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />Closing…</span> : 'Close conversation'}</button> : null}
                </div>
            </div> : <div />}
            <div ref={log} role='log' aria-label='Messages' className='min-h-0 overflow-y-auto overscroll-contain px-5 py-5'>
                {!visibleMessages.length ? <div className='flex min-h-full flex-col items-center justify-center pb-3 text-center'>
                    <h2 className='text-xl font-semibold tracking-tight text-ui-text'>What can we help with?</h2>
                    <p className='mt-2 max-w-sm text-sm leading-6 text-ui-muted'>Describe your question and we’ll point you in the right direction.</p>
                    <div className='mt-6 flex flex-wrap justify-center gap-2'>{['Account help', 'Billing question', 'Using Hanasand'].map(topic => <button key={topic} type='button' disabled={loading || sending} onClick={() => setInput(topic)} className='rounded-full border border-ui-border px-3 py-2 text-xs text-ui-text transition hover:border-ui-primary hover:bg-ui-primary/5 disabled:opacity-50'>{topic}</button>)}</div>
                </div> : <div className='grid gap-4'><ConversationMessages messages={visibleMessages} /></div>}
                {busy && !human ? <p role='status' className='mt-4 flex items-center gap-2 text-xs text-ui-muted'><LoaderCircle className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />Hanasand AI is thinking…</p> : null}
            </div>
            <div className='min-w-0 border-t border-ui-border bg-ui-raised px-4 pb-3 pt-3'>
                {error || retryable ? <div role={error ? 'alert' : 'status'} className='mb-3 text-xs leading-5 text-ui-text'>
                    {error || 'No answer yet.'}
                    {retryable ? <div className='mt-2 flex flex-wrap gap-2'>
                        <button type='button' disabled={sending || transferring} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 font-semibold text-ui-text transition-colors hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-50' onClick={() => void submit(retryable)}>Retry</button>
                        {supportMaintenance ? (
                            <a
                                href='mailto:contact@hanasand.com?subject=Support%20request'
                                className='inline-flex items-center rounded-lg border border-ui-border bg-ui-panel px-3 py-2 font-semibold text-ui-text transition-colors hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'
                            >Talk to a human by email</a>
                        ) : (
                            <button
                                type='button'
                                disabled={sending || transferring}
                                className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2 font-semibold text-ui-text transition-colors hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-50'
                                onClick={() => void submit(retryable.handoff ? retryable : { requestId: crypto.randomUUID(), message: 'I\'d like to speak with a human.', handoff: true, conversationId: retryable.conversationId })}
                            >{transferring ? <span className='inline-flex items-center gap-1.5'><LoaderCircle className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />Connecting…</span> : 'Talk to a human'}</button>
                        )}
                    </div> : null}
                </div> : null}
                {!error && connection === 'reconnecting' ? <p role='status' className='mb-2 text-xs text-ui-muted'>{refreshError || 'Reconnecting…'}</p> : null}
                <form onSubmit={send} className='flex min-w-0 items-end gap-2 rounded-2xl border border-ui-border bg-ui-panel p-2 focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/10'>
                    <textarea aria-label='Message' rows={Math.min(6, Math.max(1, input.split('\n').length))} maxLength={4000} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (!loading && !busy) send(event) } }} placeholder={human ? 'Message the support team…' : 'Ask a question…'} className='min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-5 text-ui-text outline-none placeholder:text-ui-muted' />
                    <button type='submit' disabled={loading || busy || !input.trim()} aria-label='Send message' className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ui-primary text-ui-on-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary disabled:opacity-40'>{sending ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <ArrowUp className='h-4 w-4' />}</button>
                </form>
                {human && !props.hideAgentStatus ? <div className='mt-3 flex min-h-7 items-center justify-center'><p className='flex items-center gap-1.5 text-xs text-ui-muted'><UserRound className='h-3.5 w-3.5' />{agentName ? `Speaking with ${agentName}` : 'Waiting for support.'}</p></div> : null}
            </div>
        </section>
    )
}

export function PublicSupportPanel({ initialConversation, initialSelectedId }: { initialConversation?: PublicSupportConversation; initialSelectedId?: string }) {
    const [resolved, setResolved] = useState(initialConversation?.status === 'closed')
    return (
        <section className={`support-panel mx-auto grid w-full overflow-hidden rounded-2xl border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/10 transition-[height,max-width,padding] duration-300 ease-out dark:shadow-ui-canvas/20 ${resolved ? 'max-w-lg p-6 sm:p-8' : 'h-[min(42rem,calc(100dvh-10rem))] min-h-96 max-w-4xl grid-rows-[minmax(0,1fr)]'}`} aria-label='Guest support'>
            <PublicSupportChat initialConversation={initialConversation} initialSelectedId={initialSelectedId} onResolvedChange={setResolved} />
        </section>
    )
}
