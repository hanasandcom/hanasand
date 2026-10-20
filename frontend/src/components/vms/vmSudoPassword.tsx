'use client'

import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

const PASSWORD_VISIBLE_MS = 30_000

export default function VMSudoPassword({ vmName }: { vmName: string }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const request = useRef<AbortController | null>(null)
    const titleId = useId()
    const descriptionId = useId()
    const [open, setOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [sudoPassword, setSudoPassword] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

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
        setBusy(false)
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
                signal: AbortSignal.any([controller.signal, AbortSignal.timeout(config.abortTimeout)]),
            })
            const body = await response.json().catch(() => ({})) as { password?: unknown, error?: unknown }
            if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Unable to show the VM sudo password.')
            if (typeof body.password !== 'string' || !body.password) throw new Error('The VM host returned an invalid sudo password.')
            setSudoPassword(body.password)
        } catch (cause) {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to show the VM sudo password.')
        } finally {
            if (request.current === controller) request.current = null
            setBusy(false)
        }
    }

    return <div className='grid gap-2 border-t border-ui-border pt-3'>
        <div>
            <h3 className='text-sm font-semibold text-ui-text'>VM sudo password</h3>
            <p className='mt-1 text-xs leading-5 text-ui-muted'>Reauthenticate to view it. Each successful view is recorded and emailed to the VM owner.</p>
        </div>
        <button type='button' onClick={() => { setError(''); setSudoPassword(null); setCurrentPassword(''); setOpen(true) }} className='inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-ui-border px-3 text-sm font-medium text-ui-primary transition hover:bg-ui-canvas'>
            <KeyRound className='h-4 w-4' /> Show sudo password
        </button>
        <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) closeDialog() }} className='m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-ui-backdrop'>
            <h2 id={titleId} className='text-lg font-semibold'>Show {vmName} sudo password</h2>
            <p id={descriptionId} className='mt-2 text-sm leading-6 text-ui-muted'>Enter your Hanasand account password to reauthenticate. The successful view is audit logged and emailed to the VM owner.</p>
            {sudoPassword ? <div className='mt-4 grid gap-3'>
                <label className='grid gap-2 text-sm font-medium'>Sudo password
                    <output className='select-all break-all rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 font-mono text-base' aria-live='polite'>{sudoPassword}</output>
                </label>
                <p className='text-xs text-ui-muted'>The password will be hidden automatically after 30 seconds.</p>
                <button type='button' onClick={closeDialog} className='h-10 justify-self-end rounded-lg border border-ui-border px-4 text-sm font-semibold text-ui-text hover:bg-ui-raised'>Hide password</button>
            </div> : <form onSubmit={event => void reveal(event)} className='mt-4 grid gap-3'>
                <label className='grid gap-2 text-sm font-medium'>Hanasand account password
                    <input type='password' autoFocus autoComplete='current-password' value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} required className='h-10 rounded-lg border border-ui-border bg-ui-canvas px-3 text-ui-text focus:outline-2 focus:outline-ui-primary' />
                </label>
                {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
                <div className='flex justify-end gap-2'>
                    <button type='button' onClick={closeDialog} className='h-10 rounded-lg border border-ui-border px-4 text-sm text-ui-text' disabled={busy}>Cancel</button>
                    <button type='submit' disabled={busy || !currentPassword} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:cursor-wait disabled:opacity-50'>
                        {busy ? <><EyeOff className='h-4 w-4' /> Verifying…</> : <><Eye className='h-4 w-4' /> Reauthenticate</>}
                    </button>
                </div>
            </form>}
        </dialog>
    </div>
}
