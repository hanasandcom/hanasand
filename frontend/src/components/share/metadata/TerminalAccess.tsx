import { Copy, KeyRound, TerminalSquare } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import copy from '@/utils/copy'

type Props = {
    status: string
    credentials: TerminalCredentials | null
    setDidCopy: Dispatch<SetStateAction<boolean | string | null>>
}

export default function TerminalAccess({ status, credentials, setDidCopy }: Props) {
    return (
        <section className='space-y-3 text-ui-muted'>
            <div className='rounded-lg border border-ui-success/30 bg-ui-success/10 p-3'>
                <div className='mb-2 flex items-center justify-between gap-2'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                        <TerminalSquare className='h-4 w-4 text-ui-success' />
                        Browser terminal
                    </div>
                    <span className='rounded-full border border-ui-success/35 bg-ui-success/15 px-2 py-0.5 text-[11px] font-medium text-ui-success'>
                        Interactive
                    </span>
                </div>
                <div className='flex items-start gap-2 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-xs leading-4 text-ui-muted'>
                    <span className='mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-ui-success' />
                    <span>{status || 'Waiting for terminal status...'}</span>
                </div>
            </div>

            <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-ui-text'>
                    <KeyRound className='h-4 w-4' />
                    SSH access
                </div>
                {credentials ? (
                    <AvailableCredentials credentials={credentials} setDidCopy={setDidCopy} />
                ) : <PendingCredentials />}
            </div>
        </section>
    )
}

function AvailableCredentials({ credentials, setDidCopy }: { credentials: TerminalCredentials, setDidCopy: Props['setDidCopy'] }) {
    return (
        <div className='space-y-3 text-xs'>
            <button
                type='button'
                onClick={() => copy({ text: credentials.sshCommand, setDidCopy })}
                className='flex w-full items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-left transition-colors hover:border-ui-primary hover:bg-ui-raised'
            >
                <span className='min-w-0'>
                    <span className='block text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Copy SSH command</span>
                    <span className='block truncate font-mono text-[11px] leading-4 text-ui-text'>{credentials.sshCommand}</span>
                </span>
                <Copy className='h-4 w-4 shrink-0 text-ui-muted' />
            </button>
            <CredentialRow
                label='User'
                value={credentials.username}
                setDidCopy={setDidCopy}
            />
            <CredentialRow
                label='Password'
                value={credentials.password}
                sensitive
                setDidCopy={setDidCopy}
            />
            <CredentialRow
                label='Domain'
                value={credentials.domain}
                setDidCopy={setDidCopy}
            />
        </div>
    )
}

function PendingCredentials() {
    return (
        <div className='space-y-2'>
            <button
                type='button'
                disabled
                className='flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-left opacity-55'
            >
                <span className='min-w-0'>
                    <span className='block text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Copy SSH command</span>
                    <span className='block truncate font-mono text-[11px] leading-4 text-ui-muted'>Waiting for SSH details</span>
                </span>
                <Copy className='h-4 w-4 shrink-0 text-ui-muted' />
            </button>
            <div className='rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-xs leading-5 text-ui-muted'>
                SSH details appear here when the VM is reachable.
            </div>
        </div>
    )
}

function CredentialRow({ label, value, sensitive = false, setDidCopy }: {
    label: string
    value: string
    sensitive?: boolean
    setDidCopy: Props['setDidCopy']
}) {
    return (
        <button
            type='button'
            onClick={() => copy({ text: value, setDidCopy })}
            className='group grid w-full gap-1 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-left transition-colors hover:border-ui-primary hover:bg-ui-raised'
        >
            <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ui-muted'>
                {sensitive ? <KeyRound className='h-3 w-3' /> : <Copy className='h-3 w-3' />}
                {label}
            </span>
            <span className='break-all font-mono text-[11px] leading-4 text-ui-text'>
                {sensitive ? '************' : value}
            </span>
        </button>
    )
}
