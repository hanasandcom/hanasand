import { ChevronDown, Eye, Power, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import type { TerminalLifecycle } from '@/hooks/useTerminal'
import { lifecycleLabel, lifecycleTone } from './terminalLifecycle'

type Props = {
    isConnected: boolean
    participants: number
    status: string
    lifecycle: TerminalLifecycle
    onReconnect(): void
    onRestart(): void
    onClose(): void
}

export default function TerminalHeader({ isConnected, participants, status, lifecycle, onReconnect, onRestart, onClose }: Props) {
    return (
        <div className='flex min-h-[38px] shrink-0 flex-wrap justify-between gap-2 border-t border-ui-border bg-ui-panel px-3 py-1.5 text-xs text-ui-muted'>
            <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                <span className='font-semibold text-ui-text'>Browser terminal</span>
                <span>{isConnected
                    ? <Wifi className='h-3.5 w-3.5 text-ui-success' />
                    : <WifiOff className='h-3.5 w-3.5 text-ui-text' />
                }</span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${lifecycleTone(lifecycle)}`}>
                    {lifecycleLabel(lifecycle)}
                </span>
                <span className='flex justify-between items-center gap-1'>
                    <Eye className='h-3.5 w-3.5' />
                    <h1>{participants}</h1>
                </span>
                <span className='max-w-[42vw] truncate text-ui-muted sm:max-w-[55vw]'>
                    {status}
                </span>
            </div>
            <div className='flex shrink-0 items-center gap-1'>
                <button
                    type='button'
                    aria-label='Reconnect browser terminal'
                    title='Reconnect terminal'
                    onClick={onReconnect}
                    className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-on-primary'
                >
                    <RefreshCw size={14} />
                </button>
                <button
                    type='button'
                    aria-label='Restart browser terminal'
                    title='Restart terminal'
                    onClick={onRestart}
                    className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-on-primary'
                >
                    <Power size={14} />
                </button>
                <button
                    type='button'
                    aria-label='Close terminal panel'
                    onClick={onClose}
                    className='grid h-7 w-7 place-items-center rounded-md text-ui-muted transition hover:bg-ui-primary/10 hover:text-ui-on-primary'
                >
                    <ChevronDown size={16} />
                </button>
            </div>
        </div>
    )
}
