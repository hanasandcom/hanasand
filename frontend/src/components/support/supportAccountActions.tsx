'use client'

import { useState, type FormEvent } from 'react'
import { supportFetch } from '@/utils/support/api'
import { supportFieldClass } from './supportChatStyles'

export function SupportAccountActions({ ticketId }: { ticketId: string }) {
    const [password, setPassword] = useState('')
    const [email, setEmail] = useState('')
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    async function submit(event: FormEvent<HTMLFormElement>, field: 'password' | 'email') {
        event.preventDefault()
        setBusy(true)
        setMessage('')
        try {
            const response = await supportFetch(`/support/tickets/${encodeURIComponent(ticketId)}/account/${field}`, {
                method: field === 'password' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: field === 'password' ? password : email }),
            })
            const result = await response.json().catch(() => ({})) as { error?: string }
            if (!response.ok) throw new Error(result.error || 'Account update failed.')
            setMessage(field === 'password' ? 'Password changed; the customer’s existing sessions were revoked.' : 'Email address changed.')
            if (field === 'password') setPassword('')
            else setEmail('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Account update failed.')
        } finally {
            setBusy(false)
        }
    }

    return <details className='border-b border-ui-border bg-ui-panel px-4 py-3'>
        <summary className='cursor-pointer text-xs font-semibold text-ui-text'>Account changes</summary>
        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            <form onSubmit={event => void submit(event, 'password')} className='grid gap-2'>
                <label htmlFor='support-account-password' className='text-xs text-ui-muted'>Set a new password</label>
                <input id='support-account-password' type='password' autoComplete='new-password' minLength={16} maxLength={1024} required value={password} onChange={event => setPassword(event.target.value)} className={supportFieldClass} />
                <button disabled={busy} className='rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-text disabled:opacity-50'>Change password</button>
            </form>
            <form onSubmit={event => void submit(event, 'email')} className='grid gap-2'>
                <label htmlFor='support-account-email' className='text-xs text-ui-muted'>Set a new email address</label>
                <input id='support-account-email' type='email' autoComplete='off' maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} className={supportFieldClass} />
                <button disabled={busy} className='rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-text disabled:opacity-50'>Change email</button>
            </form>
        </div>
        {message ? <p role='status' className='mt-2 text-xs text-ui-muted'>{message}</p> : null}
    </details>
}
