import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from 'hanasand/cookies'
import { sendShareEditWithProof } from '@/utils/share/sendShareEditWithProof'
import { getShare } from '@/utils/share/get'
import { handleShareCodeMessage } from './shareCodeMessages'
import { displayNameFor, getClientId, getCursorPosition, type ShareConflict, type SharePresenceUser } from './shareCodePresence'

export type { ShareConflict, SharePresenceUser } from './shareCodePresence'

type UseShareCodeSocketProps = {
    id: string
    share: Share | null
    editingContent: string
    setEditingContent: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string | boolean | null>>
    setIsConnected: Dispatch<SetStateAction<boolean>>
    setParticipants: Dispatch<SetStateAction<number>>
    setShare: Dispatch<SetStateAction<Share | null>>
    setPresenceUsers: Dispatch<SetStateAction<SharePresenceUser[]>>
    setSelfClientId: Dispatch<SetStateAction<string | null>>
    setRemoteNotice: Dispatch<SetStateAction<string | null>>
    setConflict: Dispatch<SetStateAction<ShareConflict | null>>
    onSaveStateChange?: (state: 'saved' | 'saving' | 'queued') => void
    saveState: 'saved' | 'saving' | 'queued'
    enabled?: boolean
}

export function useShareCodeSocket({
    id,
    share,
    editingContent,
    setEditingContent,
    setError,
    setIsConnected,
    setParticipants,
    setShare,
    setPresenceUsers,
    setSelfClientId,
    setRemoteNotice,
    setConflict,
    onSaveStateChange,
    saveState,
    enabled = true,
}: UseShareCodeSocketProps) {
    const [reconnect, setReconnect] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const latestContentRef = useRef(editingContent)
    const saveStateRef = useRef(saveState)
    const presenceUsersRef = useRef<SharePresenceUser[]>([])
    const pendingEditRef = useRef<string | null>(null)
    const selfClientIdRef = useRef<string | null>(null)
    const shareId = share?.id

    useEffect(() => {
        latestContentRef.current = editingContent
    }, [editingContent])

    useEffect(() => {
        saveStateRef.current = saveState
    }, [saveState])

    useEffect(() => {
        if (!enabled) {
            return
        }

        if (share) {
            setError(null)
            return
        }

        async function fetchShareState() {
            try {
                const userId = getCookie('id') ?? undefined
                const token = getCookie('access_token') ?? undefined
                const data = await getShare({ id, token, userId })
                if (typeof data === 'string') {
                    setError(data)
                    return
                }

                setError(null)
                setShare(data)
                setEditingContent(data.content)
            } catch (error) {
                console.error(`Error fetching share: ${error}`)
                setError('Failed to load share')
            }
        }

        fetchShareState()
    }, [enabled, id, setEditingContent, setError, setShare, share])

    useEffect(() => {
        if (!enabled || !shareId) {
            return
        }

        const ws = new WebSocket(`${config.url.api_wss}/share/${shareId}`)
        wsRef.current = ws

        ws.onopen = () => {
            setReconnect(false)
            setIsConnected(true)
            const clientId = getClientId()
            selfClientIdRef.current = clientId
            setSelfClientId(clientId)
            const userId = getCookie('id') || 'guest'
            ws.send(JSON.stringify({
                type: 'hello',
                clientId,
                userId,
                displayName: displayNameFor(userId),
            }))

            if (pendingEditRef.current !== null) void sendEditOverSocket(ws, pendingEditRef.current).catch(() => {
                setIsConnected(false)
                setReconnect(true)
            })
        }

        const sendEditOverSocket = async (target: WebSocket, content: string) => {
            if (!await sendShareEditWithProof(target, shareId, content, `${config.url.api_wss}/share/${shareId}`)) return
            if (pendingEditRef.current === content) pendingEditRef.current = null
            onSaveStateChange?.('saving')
        }

        ws.onclose = () => {
            setIsConnected(false)
        }

        ws.onerror = (error) => {
            console.log('WebSocket error:', error)
            setIsConnected(false)
        }
        const messageContext = {
            latestContentRef,
            saveStateRef,
            presenceUsersRef,
            setError,
            setParticipants,
            setShare,
            setEditingContent,
            setPresenceUsers,
            setRemoteNotice,
            setConflict,
            onSaveStateChange,
        }
        ws.onmessage = event => handleShareCodeMessage(event.data, messageContext)
        return () => {
            ws.close()
        }
    }, [enabled, onSaveStateChange, reconnect, setConflict, setEditingContent, setIsConnected, setParticipants, setPresenceUsers, setRemoteNotice, setSelfClientId, setShare, shareId])
    function sendEdit(content: string) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            pendingEditRef.current = content
            setReconnect(true)
            onSaveStateChange?.('queued')
            return 'queued'
        }
        const target = wsRef.current
        void (async () => {
            try {
                if (!await sendShareEditWithProof(target, shareId, content, `${config.url.api_wss}/share/${shareId}`)) { pendingEditRef.current = content; setReconnect(true); onSaveStateChange?.('queued'); return }
                pendingEditRef.current = null
            } catch { pendingEditRef.current = content; setReconnect(true); onSaveStateChange?.('queued') }
        })()
        return 'sent'
    }

    function sendCursor(selectionStart: number, selectionEnd: number, content: string) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
            return
        }
        const { line, column } = getCursorPosition(content, selectionStart)
        wsRef.current.send(JSON.stringify({
            type: 'cursor',
            line,
            column,
            selectionLength: Math.max(selectionEnd - selectionStart, 0),
            editing: true,
        }))
    }

    function sendEditing(editing: boolean) {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return
        wsRef.current.send(JSON.stringify({ type: 'editing', editing }))
    }

    return { sendEdit, sendCursor, sendEditing, selfClientId: selfClientIdRef.current }
}
