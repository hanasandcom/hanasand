import type { MouseEvent, RefObject } from 'react'
import type useTerminal from '@/hooks/useTerminal'
import type { TerminalLifecycle } from '@/hooks/useTerminal'
import TerminalViewer from './terminalViewer'
import TerminalCommandForm from './terminalCommandForm'
import TerminalHeader from './terminalHeader'

type TerminalController = ReturnType<typeof useTerminal>

type Props = {
    open: boolean
    share: Share | null
    height: number
    isDragging: boolean
    isConnected: boolean
    participants: number
    status: string
    lifecycle: TerminalLifecycle
    chunks: string[]
    isDone: boolean
    commandInputRef: RefObject<HTMLInputElement | null>
    onToggle(): void
    onResizeStart(event: MouseEvent): void
    onClose(): void
    onReconnect(): void
    onRestart(): void
    sendInput: TerminalController['sendInput']
    sendResize: TerminalController['sendResize']
}

export default function TerminalPanel({
    open,
    share,
    height,
    isDragging,
    isConnected,
    participants,
    status,
    lifecycle,
    chunks,
    isDone,
    commandInputRef,
    onToggle,
    onResizeStart,
    onClose,
    onReconnect,
    onRestart,
    sendInput,
    sendResize,
}: Props) {
    return (
        <>
            {isDragging && (
                <div
                    className='fixed inset-0 z-9999'
                    style={{ cursor: 'row-resize', userSelect: 'none', pointerEvents: 'all' }}
                />
            )}
            {!open && (
                <button
                    type='button'
                    aria-label='Open terminal panel'
                    onClick={onToggle}
                    data-testid='share-terminal-toggle'
                    className='fixed bottom-2 left-1/2 z-100 -translate-x-1/2 cursor-pointer rounded-md border border-ui-border bg-ui-panel px-8 py-1 shadow-lg backdrop-blur-md transition-all hover:bg-ui-raised'
                >
                    <div className='mx-auto mt-[2.5px] h-1 w-10 rounded-full bg-ui-muted group-hover:bg-ui-primary/30' />
                </button>
            )}
            <div
                data-testid='share-terminal-panel'
                className={`fixed inset-x-0 z-100 flex w-screen max-w-none flex-col overflow-hidden bg-ui-canvas text-ui-text shadow-lg transition-all duration-150 ease-in-out ${open ? 'visible' : 'invisible'}`}
                style={{ bottom: 0, height: open ? `${height}px` : '0px' }}
            >
                <div
                    onMouseDown={onResizeStart}
                    role='separator'
                    aria-label='Resize terminal panel'
                    className='group absolute top-0 h-2 w-full cursor-row-resize hover:bg-ui-primary/10'
                >
                    <div className='mx-auto mt-1.25 h-1 w-10 rounded-full bg-ui-muted group-hover:bg-ui-primary/30' />
                </div>
                <TerminalHeader
                    isConnected={isConnected}
                    participants={participants}
                    status={status}
                    lifecycle={lifecycle}
                    onReconnect={onReconnect}
                    onRestart={onRestart}
                    onClose={onClose}
                />
                <div className='relative min-h-0 w-full flex-1 overflow-hidden px-2 pb-2 pt-0 text-sm font-mono text-ui-muted'>
                    {open && share && <TerminalViewer
                        open={open}
                        share={share}
                        sendInput={sendInput}
                        sendResize={sendResize}
                        chunks={chunks}
                        status={status}
                        isDone={isDone}
                    />}
                    <TerminalCommandForm
                        isConnected={isConnected}
                        inputRef={commandInputRef}
                        sendInput={sendInput}
                    />
                </div>
            </div>
        </>
    )
}
