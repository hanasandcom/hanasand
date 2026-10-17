import type { RawData } from 'ws'
import { WebSocket as WS } from 'ws'
import { broadcastPromptEvent, relayPromptRequest, requestGptCompletion } from './gptPromptMessages.ts'
import { countGptViewers, gpt, gptSockets } from './gptSocketState.ts'

export { countGptViewers, gpt, gptSockets, requestGptCompletion }
type RegisteredGptClient = GPT_Client & {
    lastSeen: string
    socket: WS
}

const gptClientRegistry = new Map<string, Map<string, RegisteredGptClient>>()
function defaultModelMetrics(): GPT_ModelMetrics {
    return {
        conversationId: null,
        status: 'idle',
        currentTokens: 0,
        maxTokens: 0,
        promptTokens: 0,
        generatedTokens: 0,
        contextTokens: 0,
        contextMaxTokens: 0,
        tps: 0,
        lastUpdated: null,
        lastError: null,
    }
}

function normalizeClient(client: GPT_Client): GPT_Client {
    return {
        ...client,
        model: {
            ...defaultModelMetrics(),
            ...(client.model || {}),
        },
    }
}

export async function handleGptMessage(
    id: string,
    socket: WS,
    rawMessage: RawData,
) {
    try {
        const msg = JSON.parse(rawMessage.toString()) as { type?: string, client?: GPT_Client }

        switch (msg.type) {
            case 'update': {
                if (!msg.client) {
                    return
                }

                const normalizedClient = normalizeClient(msg.client)
                rememberClient(id, socket, normalizedClient)

                gptSockets.set(socket, {
                    role: 'producer',
                    clientName: normalizedClient.name,
                })
                broadcastUpdate(id, socket, normalizedClient)
                return
            }

            case 'prompt_request':
                relayPromptRequest(id, socket, msg as GPT_PromptRequest)
                return

            case 'prompt_started':
            case 'prompt_tool':
            case 'prompt_delta':
            case 'prompt_complete':
            case 'prompt_error':
                broadcastPromptEvent(id, socket, msg)
                return

            default:
                return
        }
    } catch (err) {
        console.error('Invalid WebSocket message:', err)
    }
}

function rememberClient(id: string, socket: WS, client: GPT_Client) {
    const bucket = gptClientRegistry.get(id) || new Map<string, RegisteredGptClient>()
    bucket.set(client.name, {
        ...client,
        lastSeen: new Date().toISOString(),
        socket,
    })
    gptClientRegistry.set(id, bucket)
}

export function listGptClients(id: string) {
    const bucket = gptClientRegistry.get(id)
    return bucket ? [...bucket.values()].map(({ socket, ...client }) => {
        void socket
        return client
    }) : []
}

export function unregisterGptSocket(id: string, socket: WS) {
    const state = gptSockets.get(socket)
    gptSockets.delete(socket)
    if (!state?.clientName) {
        return
    }

    const bucket = gptClientRegistry.get(id)
    if (!bucket) {
        return
    }

    const entry = bucket.get(state.clientName)
    if (!entry || entry.socket !== socket) {
        return
    }

    bucket.delete(state.clientName)
    if (!bucket.size) {
        gptClientRegistry.delete(id)
    }
}

export function sendGptSnapshot(id: string, socket: WS) {
    const clients = listGptClients(id)
    const participants = countGptViewers(id)
    socket.send(JSON.stringify({
        type: 'snapshot',
        clients,
        participants,
        timestamp: new Date().toISOString(),
    }))
}

function broadcastUpdate(id: string, sender: WS, client: GPT_Client) {
    const clients = gpt.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'update',
        client,
        timestamp: new Date().toISOString(),
        participants: countGptViewers(id)
    })

    for (const clientSocket of clients) {
        if (clientSocket !== sender && clientSocket.readyState === WS.OPEN) {
            clientSocket.send(payload)
        }
    }
}
