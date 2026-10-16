import { useCallback } from 'react'
import randomId from '@/utils/random/randomId'
import type { TerminalLifecycle, TerminalTransport } from './terminalTypes'

type Setters = {
    setConnectionNonce(value: (current: number) => number): void
    setChunks(value: string[]): void
    setCredentials(value: null): void
    setStatus(value: string): void
    setLifecycle(value: TerminalLifecycle): void
}

export default function useTerminalActions(sessionKey: string | null, transport: TerminalTransport, setters: Setters) {
    const { setConnectionNonce, setChunks, setCredentials, setStatus, setLifecycle } = setters
    const sendInput = useCallback((message: string) => {
        if (!sessionKey) return { status: false, message: 'Terminal is closed' }
        const payload = JSON.stringify({ type: 'terminalInput', content: message })
        const socket = transport.socket.current
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(payload)
            return { status: true }
        }
        transport.queuedMessages.current.push(payload)
        return { status: true }
    }, [sessionKey, transport])

    const sendResize = useCallback((cols: number, rows: number) => {
        if (!sessionKey) return
        transport.lastResize.current = { cols, rows }
        const payload = JSON.stringify({ type: 'resize', cols, rows })
        const socket = transport.socket.current
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(payload)
            return
        }
        transport.queuedMessages.current.push(payload)
    }, [sessionKey, transport])

    const reconnect = useCallback(() => {
        if (!sessionKey) return
        setStatus('Reconnecting terminal...')
        setLifecycle('connecting')
        transport.queuedMessages.current = []
        if (transport.socket.current) {
            transport.socket.current.close()
            return
        }
        setConnectionNonce(current => current + 1)
    }, [sessionKey, setConnectionNonce, setLifecycle, setStatus, transport])

    const restart = useCallback(() => {
        if (!sessionKey) return
        setChunks([])
        setCredentials(null)
        transport.queuedMessages.current = []
        transport.session.current = randomId(6)
        setStatus('Restarting terminal...')
        setLifecycle('connecting')
        if (transport.socket.current) {
            transport.socket.current.close()
            return
        }
        setConnectionNonce(current => current + 1)
    }, [sessionKey, setChunks, setConnectionNonce, setCredentials, setLifecycle, setStatus, transport])

    return { sendInput, sendResize, reconnect, restart }
}
