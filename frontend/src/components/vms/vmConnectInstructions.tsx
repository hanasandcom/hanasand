'use client'

import { useState } from 'react'
import { Check, Copy, Terminal } from 'lucide-react'
import { copyTextToClipboard } from '@/utils/copyTextToClipboard'

export function VMConnectInstructions({ command }: { command: string | null }) {
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const [copyFailed, setCopyFailed] = useState(false)

    async function copyCommand() {
        if (!command) return
        const success = await copyTextToClipboard(command)
        setCopied(success)
        setCopyFailed(!success)
        if (success) window.setTimeout(() => setCopied(false), 2200)
    }

    return <div className='rounded-lg border border-ui-border bg-ui-raised/50'>
        <button type='button' aria-expanded={open} onClick={() => setOpen((value) => !value)}
            className='flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ui-text transition hover:bg-ui-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/30'>
            <Terminal aria-hidden='true' className='h-4 w-4 shrink-0 text-ui-primary' />
            <span>Connect from your computer</span>
            <span className='ml-auto text-xs font-medium text-ui-muted'>{open ? 'Hide' : 'SSH · port 443'}</span>
        </button>
        {open && <div className='space-y-3 border-t border-ui-border px-3 py-3'>
            <p className='text-sm leading-5 text-ui-muted'>Open Terminal on your computer and run this command. Port 22 is blocked, so SSH connects through port 443.</p>
            {command ? <>
                <div className='flex min-w-0 items-center gap-2'>
                    <code className='min-w-0 flex-1 overflow-x-auto rounded-md bg-ui-canvas px-3 py-2 font-mono text-xs text-ui-text [scrollbar-width:thin]'>{command}</code>
                    <button type='button' onClick={copyCommand} className='inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/30'>
                        {copied ? <Check aria-hidden='true' className='h-3.5 w-3.5 text-ui-success' /> : <Copy aria-hidden='true' className='h-3.5 w-3.5' />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
                {copyFailed && <p role='status' className='text-xs text-ui-warning'>Could not copy automatically. Select and copy the command above.</p>}
            </> : <p className='rounded-md bg-ui-canvas px-3 py-2 text-xs leading-5 text-ui-muted'>The command will appear when this VM has an IP address.</p>}
            <p aria-live='polite' className='sr-only'>{copied ? 'SSH command copied to clipboard.' : ''}</p>
        </div>}
    </div>
}
