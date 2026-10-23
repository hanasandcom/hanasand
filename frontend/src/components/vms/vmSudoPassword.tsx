'use client'

import { Check, Copy, Eye, EyeOff, KeyRound } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import config from '@/config'
import { copyTextToClipboard } from '@/utils/copyTextToClipboard'
import { getCookie } from 'hanasand/cookies'

const PASSWORD_VISIBLE_MS = 30_000
const SUDO_PASSWORD_REQUEST_TIMEOUT_MS = 125_000
const SUDO_PASSWORD_UNAVAILABLE_MESSAGE = 'Unavailable. Contact Support if the problem persists.'

function supportHref(vmName: string) {
    const params = new URLSearchParams({ newTicket: 'vm-sudo-password', vm: vmName })
    return `/support?${params.toString()}`
}

type VMSudoPasswordProps = {
    vmName: string
    compact?: boolean
    triggerClassName?: string
}

export default function VMSudoPassword({ vmName, compact = false, triggerClassName }: VMSudoPasswordProps) {
    const dialog = useRef<HTMLDialogElement>(null)
    const request = useRef<AbortController | null>(null)
    const titleId = useId()
    const descriptionId = useId()
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [sudoPassword, setSudoPassword] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)
    const [copyFailed, setCopyFailed] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const element = dialog.current
        if (!open || !element) return
        element.showModal()
        return () => element.close()
    }, [open])

    useEffect(() => {
        if (!sudoPassword) return
        const timeout = setTimeout(() => {
            setSudoPassword(null)
            setOpen(false)
        }, PASSWORD_VISIBLE_MS)
        return () => clearTimeout(timeout)
    }, [sudoPassword])

    useEffect(() => () => request.current?.abort(), [])

    function closeDialog() {
        request.current?.abort()
        request.current = null
        setOpen(false)
        setCurrentPassword('')
        setSudoPassword(null)
        setError('')
        setCopied(false)
        setCopyFailed(false)
        setBusy(false)
    }

    async function copyPassword() {
        if (!sudoPassword) return
        const success = await copyTextToClipboard(sudoPassword)
        setCopied(success)
        setCopyFailed(!success)
        if (success) window.setTimeout(() => setCopied(false), 2200)
    }

    async function reveal(event: React.FormEvent) {
        event.preventDefault()
        if (busy || !currentPassword) return
        const password = currentPassword
        setCurrentPassword('')
        setError('')
        setBusy(true)
        const controller = new AbortController()
        request.current = controller
        try {
            const token = getCookie('access_token')
            const id = getCookie('id')
            if (!token || !id) throw new Error('Sign in again before viewing this password.')
            const response = await fetch(`${config.url.api}/vm/${encodeURIComponent(vmName)}/sudo-password`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, id, 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: password }),
                cache: 'no-store',
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(SUDO_PASSWORD_REQUEST_TIMEOUT_MS)]),
            })
            const body = await response.json().catch(() => ({})) as { password?: unknown, error?: unknown, code?: unknown }
            if (!response.ok) {
                if (body.code === 'SUDO_PASSWORD_UNAVAILABLE') throw new Error(SUDO_PASSWORD_UNAVAILABLE_MESSAGE)
                throw new Error(typeof body.error === 'string' ? body.error : 'Unable to show the VM sudo password.')
            }
            if (typeof body.password !== 'string' || !body.password) throw new Error('The VM host returned an invalid sudo password.')
            setSudoPassword(body.password)
        } catch (cause) {
            if (controller.signal.aborted) return
            if (cause instanceof DOMException && cause.name === 'TimeoutError') {
                setError(SUDO_PASSWORD_UNAVAILABLE_MESSAGE)
            } else {
                setError(cause instanceof Error ? cause.message : 'Unable to show the VM sudo password.')
            }
        } finally {
            if (request.current === controller) request.current = null
            setBusy(false)
        }
    }

    const trigger = <button type='button' onClick={event => {
        event.currentTarget.closest('details')?.removeAttribute('open')
        setError(''); setSudoPassword(null); setCurrentPassword(''); setCopied(false); setCopyFailed(false); setOpen(true)
    }} className={triggerClassName || 'inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-ui-border px-3 text-sm font-medium text-ui-primary transition hover:bg-ui-canvas'}>
        <KeyRound className='h-4 w-4' /> Show sudo password
    </button>

    return <>
        {compact ? trigger : <div className='grid gap-2 border-t border-ui-border pt-3'>
            <div>
                <h3 className='text-sm font-semibold text-ui-text'>VM sudo password</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted'>Reauthenticate to view it. Each successful view is recorded and emailed to the VM owner.</p>
            </div>
            {trigger}
        </div>}
        {mounted && createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) closeDialog() }} className='m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-ui-backdrop'>
            <h2 id={titleId} className='text-lg font-semibold'>Show {vmName} sudo password</h2>
            <p id={descriptionId} className='mt-2 text-sm leading-6 text-ui-muted'>Enter your password so we're sure its you.</p>
            {sudoPassword ? <div className='mt-4 grid gap-3'>
                <label className='grid gap-2 text-sm font-medium'>Sudo password
                    <span className='flex min-w-0 items-stretch gap-2'>
                        <output className='min-w-0 flex-1 select-all break-all rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 font-mono text-base' aria-live='polite'>{sudoPassword}</output>
                        <button type='button' onClick={() => void copyPassword()} aria-label={copied ? 'Sudo password copied' : 'Copy sudo password'} title={copied ? 'Copied' : 'Copy sudo password'} className='inline-flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-lg border border-ui-border bg-ui-panel text-ui-text transition hover:bg-ui-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/30'>
                            {copied ? <Check aria-hidden='true' className='h-4 w-4 text-ui-success' /> : <Copy aria-hidden='true' className='h-4 w-4' />}
                        </button>
                    </span>
                </label>
                {copyFailed && <p role='status' className='text-xs text-ui-warning'>Could not copy automatically. Select the password and copy it.</p>}
                <p aria-live='polite' className='sr-only'>{copied ? 'Sudo password copied to clipboard.' : ''}</p>
                <p className='text-xs text-ui-muted'>The password will be hidden automatically after 30 seconds.</p>
                <button type='button' onClick={closeDialog} className='h-10 justify-self-end rounded-lg border border-ui-border px-4 text-sm font-semibold text-ui-text hover:bg-ui-raised'>Hide password</button>
            </div> : <form onSubmit={event => void reveal(event)} className='mt-4 grid gap-3'>
                <label className='grid gap-2 text-sm font-medium'>Password
                    <input type='password' autoFocus autoComplete='current-password' value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} required className='h-10 rounded-lg border border-ui-border bg-ui-canvas px-3 text-ui-text focus:outline-2 focus:outline-ui-primary' />
                </label>
                {error && <p role='alert' className='text-sm text-ui-danger'>{error === 'Unavailable. Contact Support if the problem persists.' ? <>Unavailable. <a className='font-medium text-ui-primary underline underline-offset-2 hover:opacity-80' href={supportHref(vmName)}>Contact Support</a> if the problem persists.</> : error}</p>}
                <div className='flex justify-end gap-2'>
                    <button type='button' onClick={closeDialog} className='h-10 rounded-lg border border-ui-border px-4 text-sm text-ui-text' disabled={busy}>Cancel</button>
                    <button type='submit' disabled={busy || !currentPassword} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:cursor-wait disabled:opacity-50'>
                        {busy ? <><EyeOff className='h-4 w-4' /> Verifying…</> : <><Eye className='h-4 w-4' /> Confirm</>}
                    </button>
                </div>
            </form>}
        </dialog>, document.body)}
    </>
}
