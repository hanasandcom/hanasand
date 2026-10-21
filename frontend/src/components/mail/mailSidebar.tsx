'use client'

import { Archive, File, Inbox, Send, ShieldAlert, Trash2 } from 'lucide-react'
import type { MailOverview } from '@/utils/mail/types'

const icons = { inbox: Inbox, sent: Send, drafts: File, archive: Archive, junk: ShieldAlert, trash: Trash2 }

export function MailSidebar({ overview, mailboxUser, mailboxId, onAccount, onFolder }: {
    overview: MailOverview | null
    mailboxUser: string
    mailboxId: string
    onAccount: (user: string) => void
    onFolder: (id: string) => void
}) {
    const accounts = overview?.accessibleAccounts || []
    const folders = overview?.mailboxes || []
    return <aside className='hidden min-h-0 flex-col gap-4 rounded-xl border border-ui-border bg-ui-panel p-3 lg:flex'>
        <label className='grid gap-1 text-xs font-medium text-ui-muted'>Account
            <select value={mailboxUser || overview?.mailboxUser || ''} onChange={event => onAccount(event.target.value)} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-raised px-2 text-sm text-ui-text'>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.address || account.name}</option>)}
            </select>
        </label>
        <nav aria-label='Mail folders' className='grid gap-1'>
            {folders.map(folder => {
                const key = (folder.role || folder.name).toLowerCase()
                const Icon = icons[key as keyof typeof icons] || File
                return <button key={folder.id} type='button' onClick={() => onFolder(folder.id)} aria-current={mailboxId === folder.id ? 'page' : undefined}
                    className={`flex h-9 items-center gap-2 rounded-lg px-2 text-left text-sm ${mailboxId === folder.id ? 'bg-ui-primary/10 font-semibold text-ui-primary' : 'text-ui-text hover:bg-ui-raised'}`}>
                    <Icon className='h-4 w-4 shrink-0' /> <span className='min-w-0 flex-1 truncate'>{folder.name}</span>
                    {(folder.unreadEmails || 0) > 0 && <span className='text-xs text-ui-muted'>{folder.unreadEmails}</span>}
                </button>
            })}
            {!folders.length && <div aria-hidden='true' className='grid gap-2'>{[1, 2, 3, 4].map(row => <div key={row} className='h-9 animate-pulse rounded-lg bg-ui-raised' />)}</div>}
        </nav>
        {overview?.health && <div role='status' className='mt-auto border-t border-ui-border pt-3 text-xs text-ui-muted'>
            <p>Mail service: {overview.health.status}</p>
            {overview.health.checks.find(check => check.status !== 'healthy')?.detail && <p className='mt-1'>{overview.health.checks.find(check => check.status !== 'healthy')?.detail}</p>}
        </div>}
    </aside>
}
