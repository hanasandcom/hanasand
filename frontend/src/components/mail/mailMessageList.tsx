'use client'

import { Paperclip } from 'lucide-react'
import type { MailMessageSummary } from '@/utils/mail/types'

export function MailMessageList({ messages, selectedId, loading, onSelect }: {
    messages: MailMessageSummary[]
    selectedId: string
    loading: boolean
    onSelect: (message: MailMessageSummary) => void
}) {
    if (loading) return <div role='status' aria-label='Loading mail' className='grid content-start gap-2 p-3'>
        {[1, 2, 3, 4, 5, 6].map(row => <div key={row} className='h-[74px] animate-pulse rounded-lg bg-ui-raised' />)}
    </div>
    if (!messages.length) return <div className='grid min-h-56 place-content-center p-6 text-center'>
        <p className='text-sm font-medium text-ui-text'>No messages here</p><p className='mt-1 text-xs text-ui-muted'>Try another folder or search.</p>
    </div>
    return <div aria-label='Messages' className='grid content-start gap-1 overflow-y-auto p-2'>
        {messages.map(message => {
            const sender = message.from.map(item => item.name || item.email).join(', ') || 'Unknown sender'
            const value = message.receivedAt ? new Date(message.receivedAt) : null
            const date = value && Number.isFinite(value.getTime()) ? value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
            return <button key={message.id} type='button' onClick={() => onSelect(message)} aria-current={selectedId === message.id ? 'true' : undefined}
                className={`grid min-w-0 gap-1 rounded-lg border px-3 py-2 text-left transition ${selectedId === message.id ? 'border-ui-primary/40 bg-ui-primary/10' : 'border-transparent bg-ui-raised hover:border-ui-border hover:bg-ui-panel'}`}>
                <span className='flex min-w-0 items-center gap-2 text-xs'>
                    {!message.isRead && <span aria-label='Unread' className='h-2 w-2 shrink-0 rounded-full bg-ui-primary' />}
                    <span className='min-w-0 flex-1 truncate font-semibold text-ui-text'>{sender}</span><time className='shrink-0 text-ui-muted'>{date}</time>
                </span>
                <span className='flex min-w-0 items-center gap-1.5 text-sm'>
                    <span className='min-w-0 flex-1 truncate font-medium text-ui-text'>{message.subject || '(No subject)'}</span>
                    {message.hasAttachment && <Paperclip aria-label='Has attachment' className='h-3.5 w-3.5 shrink-0 text-ui-muted' />}
                </span>
                <span className='truncate text-xs text-ui-muted'>{message.preview}</span>
            </button>
        })}
    </div>
}
