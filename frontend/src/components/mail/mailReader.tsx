'use client'

import { useState } from 'react'
import { Archive, ArrowLeft, Download, Reply, ReplyAll, Star, Trash2 } from 'lucide-react'
import { fetchMailBlob } from '@/utils/mail/client'
import type { MailMessage, MailMessageSummary } from '@/utils/mail/types'

function plainText(html: string) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, '\'').replace(/&quot;/gi, '"').replace(/[ \t]+/g, ' ').trim()
}

export function MailReader({ message, summary, mailboxUser, loading, working, onAction, onReply, onBack }: {
    message: MailMessage | null
    summary: MailMessageSummary | null
    mailboxUser: string
    loading: boolean
    working: boolean
    onAction: (action: 'archive' | 'trash' | 'read' | 'unread' | 'flag' | 'unflag') => void
    onReply: (message: MailMessage, all?: boolean) => void
    onBack: () => void
}) {
    const [downloading, setDownloading] = useState('')
    const [downloadError, setDownloadError] = useState('')
    async function download(blobId: string, name: string) {
        setDownloading(blobId)
        setDownloadError('')
        try {
            const blob = await fetchMailBlob(mailboxUser, blobId, name)
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url; link.download = name; link.click()
            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch { setDownloadError('Could not download this attachment. Try again.') }
        finally { setDownloading('') }
    }
    if (loading && !message) return <div role='status' aria-label='Loading message' className='m-4 h-64 animate-pulse rounded-lg bg-ui-raised' />
    if (!message) return <div className='grid min-h-64 place-content-center p-6 text-center text-sm text-ui-muted'>Choose a message to read it.</div>
    const summaryMessage = summary || message
    const dateValue = message.receivedAt ? new Date(message.receivedAt) : null
    const date = dateValue && Number.isFinite(dateValue.getTime()) ? dateValue.toLocaleString() : ''
    return <article className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <div className='flex flex-wrap items-center gap-2 border-b border-ui-border p-3'>
            <button type='button' onClick={onBack} aria-label='Back to messages' className='mr-1 rounded-md p-2 text-ui-muted hover:bg-ui-raised md:hidden'><ArrowLeft className='h-4 w-4' /></button>
            <button type='button' disabled={working} onClick={() => onAction('archive')} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'><Archive className='h-4 w-4' />Archive</button>
            <button type='button' disabled={working} onClick={() => onAction('trash')} aria-label='Delete message' className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'><Trash2 className='h-4 w-4' />Delete</button>
            <button type='button' disabled={working} onClick={() => onAction(message.isRead ? 'unread' : 'read')} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>{message.isRead ? 'Mark unread' : 'Mark read'}</button>
            <button type='button' disabled={working} onClick={() => onAction(message.isFlagged ? 'unflag' : 'flag')} aria-label={message.isFlagged ? 'Remove star' : 'Star message'} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'><Star className={`h-4 w-4 ${message.isFlagged ? 'fill-current text-ui-warning' : ''}`} /></button>
            <span className='flex-1' />
            <button type='button' onClick={() => onReply(message)} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'><Reply className='h-4 w-4' />Reply</button>
            <button type='button' onClick={() => onReply(message, true)} aria-label='Reply all' className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'><ReplyAll className='h-4 w-4' /></button>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto p-4 sm:p-6'>
            {downloadError && <p role='alert' className='mb-3 text-sm text-ui-danger'>{downloadError}</p>}
            <h1 className='break-words text-xl font-semibold text-ui-text'>{message.subject || '(No subject)'}</h1>
            <div className='mt-4 grid gap-1 text-sm text-ui-muted'>
                <p><span className='text-ui-text'>From </span>{message.from.map(item => item.name ? `${item.name} <${item.email}>` : item.email).join(', ')}</p>
                <p><span className='text-ui-text'>To </span>{message.to.map(item => item.email).join(', ')}</p>
                {message.cc.length > 0 && <p><span className='text-ui-text'>Cc </span>{message.cc.map(item => item.email).join(', ')}</p>}
                <time>{date}</time>
            </div>
            {message.attachments.length > 0 && <div className='mt-5 flex flex-wrap gap-2' aria-label='Attachments'>
                {message.attachments.map(file => <button key={file.blobId} type='button' onClick={() => void download(file.blobId, file.name)} disabled={Boolean(downloading)} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-[11px] font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>
                    <Download className='h-4 w-4' />{downloading === file.blobId ? 'Downloading…' : `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`}
                </button>)}
            </div>}
            <div className='mt-6 whitespace-pre-wrap break-words border-t border-ui-border pt-5 text-sm leading-6 text-ui-text'>{message.textBody || plainText(message.htmlBody) || summaryMessage.preview || 'This message has no readable text.'}</div>
        </div>
    </article>
}
