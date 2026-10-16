import { useEffect, useRef, useState } from 'react'
import defaultModelMetrics from './defaultModelMetrics'
import normalizeClient from './normalizeClient'
import { applyPromptEvent } from './chatReducers'
import config from '@/config'

function createPendingAssistantMessage(conversationId: string): GPT_ChatMessage {
    return { id: `${conversationId}-assistant`, role: 'assistant', content: '', pending: true }
}

export default function useGptPageState() {
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [chatSession, setChatSession] = useState<ChatSession | null>(null)
    const socketRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        let cancelled = false
        let retry: ReturnType<typeof setTimeout> | undefined
        function connect() {
            const ws = new WebSocket(`${config.url.api_client_wss}/client/ws/gpt`)
            socketRef.current = ws
            ws.onopen = () => { if (!cancelled) setIsConnected(true) }
            ws.onclose = () => {
                if (cancelled) return
                setIsConnected(false)
                setClients([])
                socketRef.current = null
                retry = setTimeout(connect, 3000)
            }
            ws.onerror = () => ws.close()
            ws.onmessage = event => {
                if (cancelled) return
                try {
                    handleSocketMessage(JSON.parse(event.data) as GptSocketMessage, setChatSession, setClients, setParticipants)
                } catch (error) {
                    console.error('Invalid model update:', error)
                }
            }
        }
        connect()
        return () => {
            cancelled = true
            clearTimeout(retry)
            socketRef.current?.close()
            socketRef.current = null
        }
    }, [])

    function openChat(client: GPT_Client) {
        setChatSession((prev) => prev?.clientName === client.name
            ? { ...prev, metrics: client.model }
            : {
                clientName: client.name,
                conversationId: crypto.randomUUID(),
                messages: [],
                isSending: false,
                metrics: client.model || defaultModelMetrics(),
            })
    }

    function sendPrompt(content: string) {
        if (!chatSession || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return
        }

        const userMessage: GPT_ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
        const requestMessages = [...chatSession.messages, userMessage]
            .filter(message => message.role === 'user' || message.role === 'assistant')
            .map(message => ({ role: message.role, content: message.content }))

        setChatSession((prev) => prev
            ? {
                ...prev,
                isSending: true,
                messages: [...prev.messages, userMessage, createPendingAssistantMessage(prev.conversationId)],
            }
            : prev)

        socketRef.current.send(JSON.stringify({
            type: 'prompt_request',
            conversationId: chatSession.conversationId,
            clientName: chatSession.clientName,
            messages: requestMessages,
            maxTokens: 512,
            temperature: 0.7,
        }))
    }

    const activeClient = chatSession
        ? clients.find(client => client.name === chatSession.clientName) || null
        : null

    return {
        activeClient,
        chatSession,
        clients,
        closeChat: () => setChatSession(null),
        isConnected,
        openChat,
        participants,
        sendPrompt,
    }
}

function handleSocketMessage(
    msg: GptSocketMessage,
    setChatSession: React.Dispatch<React.SetStateAction<ChatSession | null>>,
    setClients: React.Dispatch<React.SetStateAction<GPT_Client[]>>,
    setParticipants: React.Dispatch<React.SetStateAction<number>>
) {
    switch (msg.type) {
        case 'snapshot':
            setClients((msg.clients || []).map(normalizeClient))
            setParticipants(msg.participants || 0)
            return
        case 'update': {
            if (!msg.client) return
            const normalizedClient = normalizeClient(msg.client)
            setParticipants(msg.participants || 0)
            setClients((prev) => {
                const existing = prev.find(client => client.name === normalizedClient.name)
                return existing
                    ? prev.map(client => client.name === normalizedClient.name
                        ? { ...client, ...normalizedClient, model: normalizedClient.model }
                        : client)
                    : [...prev, normalizedClient]
            })
            setChatSession((prev) => (
                !prev || prev.clientName !== normalizedClient.name
                    ? prev
                    : { ...prev, metrics: normalizedClient.model }
            ))
            return
        }
        case 'join':
            setParticipants(msg.participants || 0)
            return
        case 'prompt_started':
        case 'prompt_delta':
        case 'prompt_complete':
        case 'prompt_error':
            return setChatSession(prev => applyPromptEvent(
                prev,
                msg,
                (session, content) => ({ ...session.metrics, status: 'error', lastError: content })
            ))
        default:
            return
    }
}
