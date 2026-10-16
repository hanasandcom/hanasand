import { useEffect, useMemo, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import randomId from '@/utils/random/randomId'
import { isTerminalCredentials, lifecycleFromTerminalUpdate, statusFromTerminalUpdate } from './terminalMessageState'
import type { TerminalCredentials, TerminalLifecycle, TerminalTransport } from './terminalTypes'

type Props = {
    sessionKey: string | null
    shareAlias: string | null
}

export default function useTerminalConnection({ sessionKey, shareAlias }: Props) {
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [chunks, setChunks] = useState<string[]>([])
    const [status, setStatus] = useState('Terminal closed.')
    const [credentials, setCredentials] = useState<TerminalCredentials | null>(null)
    const [lifecycle, setLifecycle] = useState<TerminalLifecycle>('closed')
    const [connectionNonce, setConnectionNonce] = useState(0)
    const activeSessionRef = useRef<string | null>(sessionKey)
    const socket = useRef<WebSocket | null>(null)
    const queuedMessages = useRef<string[]>([])
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastResize = useRef<{ cols: number, rows: number } | null>(null)
    const session = useRef<string | null>(null)
    const transport = useMemo<TerminalTransport>(() => ({ socket, queuedMessages, reconnectTimeout, lastResize, session }), [])

    useEffect(() => { activeSessionRef.current = sessionKey }, [sessionKey])

    useEffect(() => {
        if (!sessionKey || !shareAlias) {
            setStatus('Terminal closed.')
            setLifecycle('closed')
            return
        }
        const activeSessionKey = sessionKey

        queuedMessages.current = []
        setCredentials(null)
        session.current = randomId(6)
        setStatus('Connecting to terminal...')
        setLifecycle('connecting')
        let disposed = false

        function clearReconnect() {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current)
                reconnectTimeout.current = null
            }
        }

        function flushQueue(ws: WebSocket) {
            while (queuedMessages.current.length && ws.readyState === WebSocket.OPEN) {
                const next = queuedMessages.current.shift()
                if (next) ws.send(next)
            }
        }

        function connect() {
            if (disposed) return
            const currentSession = session.current || randomId(6)
            session.current = currentSession
            const terminalUser = getCookie('id') || 'default'
            const ws = new WebSocket(`${config.url.api_wss}/share/${shareAlias}/shell/${terminalUser}/${currentSession}`)
            socket.current = ws

            ws.onopen = () => {
                clearReconnect()
                if (activeSessionRef.current !== sessionKey) return
                setChunks([])
                setParticipants(1)
                setIsConnected(true)
                setStatus('Preparing terminal...')
                setLifecycle('preparing')
                flushQueue(ws)
                if (lastResize.current && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'resize', cols: lastResize.current.cols, rows: lastResize.current.rows }))
                }
            }

            ws.onclose = () => {
                if (socket.current === ws) socket.current = null
                if (activeSessionRef.current === sessionKey) {
                    setIsConnected(false)
                    setStatus(disposed ? 'Terminal closed.' : 'Reconnecting terminal...')
                    setLifecycle(disposed ? 'closed' : 'connecting')
                }
                if (!disposed) reconnectTimeout.current = setTimeout(connect, 1000)
            }

            ws.onerror = error => {
                console.log('WebSocket error:', error)
                if (activeSessionRef.current !== sessionKey) return
                setIsConnected(false)
                setStatus('Terminal connection error. Retrying...')
                setLifecycle('error')
            }

            ws.onmessage = event => handleMessage(event, activeSessionKey, activeSessionRef, {
                setParticipants, setStatus, setLifecycle, setChunks, setCredentials,
            })
        }

        connect()
        return () => {
            disposed = true
            clearReconnect()
            queuedMessages.current = []
            if (socket.current) {
                const current = socket.current
                socket.current = null
                current.close()
            }
        }
    }, [connectionNonce, sessionKey, shareAlias])

    return {
        isConnected, participants, chunks, status, credentials, lifecycle, transport,
        setConnectionNonce, setChunks, setCredentials, setStatus, setLifecycle,
    }
}

function handleMessage(
    event: MessageEvent,
    sessionKey: string,
    activeSessionRef: { current: string | null },
    setters: {
        setParticipants: (value: number) => void
        setStatus: (value: string) => void
        setLifecycle: (value: (current: TerminalLifecycle) => TerminalLifecycle) => void
        setChunks: (value: (previous: string[]) => string[]) => void
        setCredentials: (value: TerminalCredentials) => void
    },
) {
    void (async() => {
        try {
            let data = event.data
            if (data instanceof Blob) data = await data.text()
            const message = JSON.parse(data)
            if (activeSessionRef.current !== sessionKey) return
            if (message.type === 'update') {
                setters.setParticipants(message.participants || 1)
                if (typeof message.content !== 'string') return
                const nextStatus = statusFromTerminalUpdate(message.content)
                if (nextStatus) setters.setStatus(nextStatus)
                const nextLifecycle = lifecycleFromTerminalUpdate(message.content)
                if (nextLifecycle) setters.setLifecycle(current => current === 'ready' && nextLifecycle === 'preparing' ? current : nextLifecycle)
                setters.setChunks(previous => [...previous, message.content])
            }
            if (message.type === 'terminal_credentials' && isTerminalCredentials(message.credentials)) {
                setters.setCredentials(message.credentials)
                setters.setStatus('Terminal ready.')
                setters.setLifecycle(() => 'ready')
            }
            if (message.type === 'join') setters.setParticipants(message.participants || 1)
        } catch (error) {
            console.error(`Invalid message from server: ${error}`)
        }
    })()
}
