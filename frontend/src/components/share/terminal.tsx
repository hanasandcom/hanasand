import { useEffect, useRef, useState } from 'react'
import useTerminal, { type TerminalCredentials } from '@/hooks/useTerminal'
import TerminalPanel from './terminalPanel'
import { useTerminalPanelControls } from './useTerminalPanelControls'

type ConsoleProps = {
    open: boolean
    setOpen: React.Dispatch<React.SetStateAction<boolean>>
    share: Share | null
    shareTerminalHeight: number
    triggerChange: boolean | 'close'
    setTriggerChange: React.Dispatch<React.SetStateAction<boolean | 'close'>>
    setTerminalStatus: React.Dispatch<React.SetStateAction<string>>
    setTerminalCredentials: React.Dispatch<React.SetStateAction<TerminalCredentials | null>>
}

export default function Terminal({
    share,
    open,
    setOpen,
    shareTerminalHeight,
    triggerChange,
    setTriggerChange,
    setTerminalStatus,
    setTerminalCredentials,
}: ConsoleProps) {
    const [isDone, setIsDone] = useState(false)
    const commandInputRef = useRef<HTMLInputElement | null>(null)
    const terminal = useTerminal({ share, active: open && Boolean(share) })
    const { height, isDragging, handleChange, handleResizeStart } = useTerminalPanelControls({
        open,
        setOpen,
        shareTerminalHeight,
        triggerChange,
        setTriggerChange,
        commandInputRef,
    })

    useEffect(() => {
        const timeout = window.setTimeout(() => setIsDone(true), 1000)
        return () => window.clearTimeout(timeout)
    }, [])

    useEffect(() => {
        setTerminalStatus(terminal.status)
    }, [setTerminalStatus, terminal.status])

    useEffect(() => {
        setTerminalCredentials(terminal.credentials)
    }, [setTerminalCredentials, terminal.credentials])

    return (
        <TerminalPanel
            open={open}
            share={share}
            height={height}
            isDragging={isDragging}
            isConnected={terminal.isConnected}
            participants={terminal.participants}
            status={terminal.status}
            lifecycle={terminal.lifecycle}
            chunks={terminal.chunks}
            isDone={isDone}
            commandInputRef={commandInputRef}
            onToggle={handleChange}
            onResizeStart={handleResizeStart}
            onClose={() => setOpen(false)}
            onReconnect={terminal.reconnect}
            onRestart={terminal.restart}
            sendInput={terminal.sendInput}
            sendResize={terminal.sendResize}
        />
    )
}
