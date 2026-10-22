'use client'

import { Check, Copy, LoaderCircle, Terminal, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { copyTextToClipboard } from '@/utils/copyTextToClipboard'

type VMConnectionResponse = { sshCommand?: unknown }

type VMConnectLocallyProps = {
    vmName: string
    className?: string
}

export default function VMConnectLocally({ vmName, className }: VMConnectLocallyProps) {
    const dialog = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const [mounted, setMounted] = useState(false)
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [command, setCommand] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)
    const [copyFailed, setCopyFailed] = useState(false)

    useEffect(() => setMounted(true), [])
    useEffect(() => {
        const element = dialog.current
        if (!open || !element) return
        element.showModal()
        return () => element.close()
    }, [open])

    async function showCommand(event: React.MouseEvent<HTMLButtonElement>) {
        event.currentTarget.closest('details')?.removeAttribute('open')
        setOpen(true)
        setLoading(true)
        setError('')
        setCommand(null)
        setCopied(false)
        setCopyFailed(false)
        try {
            const response = await fetch(`/api/backend/vm/${encodeURIComponent(vmName)}/connection`, { cache: 'no-store' })
            if (response.status === 401) {
                const path = window.location.pathname + window.location.search + window.location.hash
                const login = '/login?' + new URLSearchParams({ path, expired: 'true' })
                window.location.replace('/logout?' + new URLSearchParams({ path: login }))
                return
            }
            if (!response.ok) throw new Error(response.status === 403 ? 'You do not have permission to view this VM’s connection details.' : 'Connection details are unavailable. Try again shortly.')
            const body = await response.json() as VMConnectionResponse
            setCommand(typeof body.sshCommand === 'string' && body.sshCommand ? body.sshCommand : null)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Connection details are unavailable. Try again shortly.')
        } finally {
            setLoading(false)
        }
    }

    async function copyCommand() {
        if (!command) return
        const success = await copyTextToClipboard(command)
        setCopied(success)
        setCopyFailed(!success)
        window.setTimeout(() => setCopied(false), 2200)
    }

    return <>
        <button type='button' onClick={event => void showCommand(event)} className={className || 'inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-text transition hover:bg-ui-raised'}>
            <Terminal aria-hidden='true' className='h-4 w-4' /> Connect locally
        </button>
        {mounted && createPortal(<dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setOpen(false) }} className='m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-ui-backdrop'>
            <div className='flex items-start justify-between gap-4'>
                <div>
                    <h2 id={titleId} className='text-lg font-semibold'>Connect to {vmName}</h2>
                    <p className='mt-1 text-sm leading-5 text-ui-muted'>Run this SSH command in Terminal on your computer. SSH uses port 443.</p>
                </div>
                <button type='button' aria-label='Close connection details' onClick={() => setOpen(false)} className='rounded-md p-1 text-ui-muted hover:bg-ui-raised hover:text-ui-text'><X className='h-4 w-4' /></button>
            </div>
            {loading ? <p role='status' className='mt-4 flex items-center gap-2 text-sm text-ui-muted'><LoaderCircle className='h-4 w-4 animate-spin' />Loading connection command…</p>
                : error ? <p role='alert' className='mt-4 text-sm text-ui-danger'>{error}</p>
                    : command ? <div className='mt-4 flex min-w-0 items-center gap-2'>
                        <code className='min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-ui-border bg-ui-canvas px-3 py-2.5 font-mono text-xs text-ui-text [scrollbar-width:thin]'>{command}</code>
                        <button type='button' onClick={() => void copyCommand()} aria-label={copied ? 'SSH command copied' : 'Copy SSH command'} title={copied ? 'Copied' : 'Copy SSH command'} className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ui-border bg-ui-panel text-ui-text hover:bg-ui-raised'>
                            {copied ? <Check aria-hidden='true' className='h-4 w-4 text-ui-success' /> : <Copy aria-hidden='true' className='h-4 w-4' />}
                        </button>
                    </div> : <p className='mt-4 rounded-lg border border-ui-border bg-ui-canvas p-3 text-sm leading-5 text-ui-muted'>The SSH command is not ready yet. Add an SSH key to your profile and try again once the VM has an IP address.</p>}
            {copyFailed && <p role='status' className='mt-2 text-xs text-ui-warning'>Could not copy automatically. Select and copy the command above.</p>}
            <p aria-live='polite' className='sr-only'>{copied ? 'SSH command copied to clipboard.' : ''}</p>
            <div className='mt-5 flex justify-end'><button type='button' onClick={() => setOpen(false)} className='h-10 rounded-lg border border-ui-border px-4 text-sm font-semibold text-ui-text hover:bg-ui-raised'>Close</button></div>
        </dialog>, document.body)}
    </>
}
