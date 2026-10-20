import { useEffect } from 'react'
import config from '@/config'
import { createWorkbenchSocket } from './workbenchSocket'
import type { WorkbenchState } from './useWorkbenchState'

export function useWorkbenchConnection(state: WorkbenchState) {
    const { socketRef, reconnectTimerRef, shouldReconnectRef, setIsConnected, setStatusNotice, handleSocketMessageRef } = state
    useEffect(() => {
        shouldReconnectRef.current = true
        const connect = () => {
            const ws = createWorkbenchSocket(`${config.url.api_client_wss}/client/ws/gpt`)
            socketRef.current = ws
            ws.onopen = () => {
                setIsConnected(true)
                setStatusNotice(null)
            }
            ws.onclose = () => {
                setIsConnected(false)
                socketRef.current = null
                if (!shouldReconnectRef.current) return
                setStatusNotice('Connection lost. Reconnecting…')
                reconnectTimerRef.current = setTimeout(connect, 2000)
            }
            ws.onerror = () => setIsConnected(false)
            ws.onmessage = (event) => {
                try {
                    handleSocketMessageRef.current(JSON.parse(event.data) as GptSocketMessage)
                } catch (error) {
                    console.error('Invalid AI socket payload', error)
                }
            }
        }
        connect()
        return () => {
            shouldReconnectRef.current = false
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
            socketRef.current?.close()
        }
    }, [handleSocketMessageRef, reconnectTimerRef, setIsConnected, setStatusNotice, shouldReconnectRef, socketRef])
}
