import { useShareTerminalViewer } from './useShareTerminalViewer'

type TerminalViewerProps = {
    open: boolean
    share: Share
    chunks: string[]
    status: string
    isDone?: boolean
    sendInput: (message: string) => { status: boolean, message?: string }
    sendResize: (cols: number, rows: number) => void
}

export default function TerminalViewer({ open, share, chunks, status, sendInput, sendResize }: TerminalViewerProps) {
    const { containerRef, focusTerminal } = useShareTerminalViewer({
        open,
        shareId: share.id,
        chunks,
        sendInput,
        sendResize,
    })

    return (
        <div className='relative h-full min-w-0 w-full overflow-hidden rounded-md bg-ui-canvas'>
            {chunks.length === 0 && status && (
                <div className='pointer-events-none absolute inset-0 z-10 flex items-start px-3 py-3 text-sm font-medium text-ui-muted'>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel/80 px-3 py-2'>
                        <span className='h-2 w-2 animate-pulse rounded-full bg-ui-success' />
                        {status}
                    </span>
                </div>
            )}
            <div
                ref={containerRef}
                onClick={focusTerminal}
                className='h-full min-w-0 w-full overflow-hidden rounded-md bg-ui-canvas'
                data-share-terminal={share.alias}
                data-testid='share-terminal-xterm'
            />
        </div>
    )
}
