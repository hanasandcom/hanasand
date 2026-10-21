'use client'

import { useMemo, useState } from 'react'
import { MailPlus, RefreshCw, Search, X } from 'lucide-react'
import type { MailMessageSummary } from '@/utils/mail/types'
import { MailComposer } from './mailComposer'
import { MailMessageList } from './mailMessageList'
import { MailReader } from './mailReader'
import { MailSelect } from './mailSelect'
import { MailSidebar } from './mailSidebar'
import { useMailWorkspace } from './useMailWorkspace'

const filters = ['all', 'unread', 'starred', 'attachments'] as const
const panelClass = 'rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20'

export default function MailWorkspace({ mailboxUser }: { mailboxUser?: string | null }) {
    const mail = useMailWorkspace(mailboxUser)
    const [filter, setFilter] = useState<typeof filters[number]>('all')
    const [mobileReader, setMobileReader] = useState(false)
    const visible = useMemo(() => mail.messages.filter(message => filter === 'unread' ? !message.isRead : filter === 'starred' ? message.isFlagged : filter === 'attachments' ? message.hasAttachment : true), [filter, mail.messages])
    const selectedSummary = mail.messages.find(message => message.id === mail.selectedMessageId) || null
    const choose = (message: MailMessageSummary) => { setMobileReader(true); void mail.selectMessage(message) }

    return <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }} className='@container !gap-3 !px-3 !py-3 text-ui-text'>
        <h1 className='sr-only'>Mail</h1>
        <section className={`${panelClass} flex flex-wrap items-center gap-2 p-2.5 sm:p-3`}>
            <div className='min-w-36 flex-1 sm:min-w-48'><p className='text-[10px] text-ui-muted'>Mailbox</p><p className='truncate text-xs font-medium text-ui-text'>{mail.overview?.mailboxAddress || 'Loading mailbox…'}</p></div>
            {mail.overview?.accessibleAccounts.length ? <MailSelect id='mail-account-mobile' label='Mail account' value={mail.mailboxUser} onChange={mail.switchAccount} options={mail.overview.accessibleAccounts.map(account => ({ id: account.id, label: account.address || account.name }))} compact className='w-40 lg:hidden' /> : null}
            {mail.overview?.mailboxes.length ? <MailSelect id='mail-folder-mobile' label='Mail folder' value={mail.mailboxId} onChange={mail.selectFolder} options={mail.overview.mailboxes.map(folder => ({ id: folder.id, label: folder.name }))} compact className='w-32 lg:hidden' /> : null}
            <label className='sr-only' htmlFor='mail-search'>Search messages</label>
            <div className='relative min-w-36 flex-1 sm:max-w-xs'><Search className='absolute left-2.5 top-2 h-4 w-4 text-ui-muted' /><input id='mail-search' value={mail.searchText} onChange={event => mail.setSearchText(event.target.value)} placeholder='Search mail' className='h-8 w-full rounded-lg border border-ui-border bg-ui-raised pl-8 pr-8 text-xs text-ui-text outline-none focus:border-ui-primary' />{mail.searchText && <button type='button' aria-label='Clear search' onClick={() => mail.setSearchText('')} className='absolute right-2 top-2 text-ui-muted'><X className='h-4 w-4' /></button>}</div>
            <button type='button' onClick={() => void mail.load()} aria-label='Refresh mail' className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-raised px-2.5 text-xs text-ui-text hover:bg-ui-panel'><RefreshCw className={`h-3.5 w-3.5 ${mail.loading ? 'animate-spin' : ''}`} />Refresh</button>
            <button type='button' disabled={!mail.overview || mail.loading || mail.overview.actor.canSend === false} onClick={() => mail.setDraft({ to: '', cc: '', bcc: '', subject: '', textBody: '', attachments: [] })} className='inline-flex h-8 items-center gap-1.5 rounded-lg bg-ui-primary px-3 text-xs font-semibold text-ui-on-primary disabled:cursor-not-allowed disabled:opacity-50'><MailPlus className='h-3.5 w-3.5' />Compose</button>
        </section>
        {mail.error && <div role='alert' className='flex items-center gap-3 rounded-lg border border-ui-warning/40 bg-ui-warning/10 px-3 py-2 text-sm text-ui-text'><span className='min-w-0 flex-1'>{mail.error}</span><button type='button' onClick={() => { mail.setError(''); void mail.load() }} className='font-medium text-ui-primary'>Retry</button></div>}
        <div className='grid min-h-[60vh] flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]'>
            <MailSidebar overview={mail.overview} mailboxUser={mail.mailboxUser} mailboxId={mail.mailboxId} onAccount={mail.switchAccount} onFolder={mail.selectFolder} />
            <section className={`${panelClass} grid min-h-[60vh] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0 md:grid-cols-[minmax(250px,0.85fr)_minmax(0,1.5fr)] md:grid-rows-1`}>
                <section aria-label='Message list' className={`${mobileReader ? 'hidden' : 'flex'} min-h-0 flex-col border-ui-border md:flex md:border-r`}>
                    <div className='flex flex-wrap gap-1 border-b border-ui-border p-2'>
                        {filters.map(item => <button key={item} type='button' onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-md px-2 py-1 text-[11px] capitalize ${filter === item ? 'bg-ui-primary/10 font-semibold text-ui-primary' : 'text-ui-muted hover:bg-ui-raised'}`}>{item}</button>)}
                        <span className='ml-auto self-center text-[11px] text-ui-muted'>{visible.length}</span>
                    </div>
                    <MailMessageList messages={visible} selectedId={mail.selectedMessageId} loading={mail.loading} onSelect={choose} />
                </section>
                <section aria-label='Message reader' className={`${mobileReader ? 'flex' : 'hidden'} min-h-0 flex-col md:flex`}>
                    <MailReader message={mail.selectedMessage} summary={selectedSummary} mailboxUser={mail.mailboxUser} loading={mail.loading || mail.messageLoading} working={mail.working} onAction={action => selectedSummary && void mail.act(selectedSummary, action)} onReply={mail.reply} onBack={() => setMobileReader(false)} />
                </section>
            </section>
        </div>
        {mail.draft && <MailComposer initial={mail.draft} busy={mail.working} onClose={() => mail.setDraft(null)} onSend={value => void mail.send(value)} />}
    </div>
}
