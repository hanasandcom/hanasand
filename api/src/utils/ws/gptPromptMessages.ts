import { WebSocket as WS } from 'ws'
import { gpt, gptSockets } from './gptSocketState.ts'

type GPT_PromptCompletion = {
    type?: string
    conversationId?: string
    clientName?: string | null
    content?: string
    error?: string
    artifacts?: unknown[]
    metrics?: GPT_ModelMetrics
}

const pendingPromptRequests = new Map<string, {
    resolve: (event: GPT_PromptCompletion) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
}>()

export async function requestGptCompletion(id: string, request: Omit<GPT_PromptRequest, 'type'>, timeoutMs = 120_000) {
    const clients = gpt.get(id)
    if (!clients) {
        throw new Error('No Hanasand AI model client is connected.')
    }

    const targets = [...clients].filter((client) => {
        if (client.readyState !== WS.OPEN) return false
        const state = gptSockets.get(client)
        return Boolean(state?.role === 'producer' && (!request.clientName || state.clientName === request.clientName))
    })

    if (!targets.length) {
        throw new Error(request.clientName
            ? `Hanasand AI client ${request.clientName} is not connected.`
            : 'No Hanasand AI model client is connected.')
    }

    const conversationId = request.conversationId || `tools-${crypto.randomUUID()}`
    const promptRequest: GPT_PromptRequest = { ...request, conversationId, type: 'prompt_request' }
    const completion = await new Promise<GPT_PromptCompletion>((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingPromptRequests.delete(conversationId)
            reject(new Error('Hanasand AI timed out while generating a response.'))
        }, timeoutMs)
        pendingPromptRequests.set(conversationId, { resolve, reject, timeout })
        targets[0].send(JSON.stringify(promptRequest))
    })

    return completion
}

export function relayPromptRequest(id: string, requester: WS, request: GPT_PromptRequest) {
    const clients = gpt.get(id)
    if (!clients) return

    const targets = [...clients].filter((client) => {
        if (client === requester || client.readyState !== WS.OPEN) return false
        const state = gptSockets.get(client)
        return Boolean(state?.role === 'producer' && (!request.clientName || state.clientName === request.clientName))
    })

    if (!targets.length) {
        requester.send(JSON.stringify({
            type: 'prompt_error',
            conversationId: request.conversationId,
            clientName: request.clientName || null,
            error: request.clientName
                ? `Client ${request.clientName} is not connected.`
                : 'No model client is connected.',
            timestamp: new Date().toISOString(),
        }))
        return
    }

    targets[0].send(JSON.stringify(request))
}

export function broadcastPromptEvent(id: string, sender: WS, event: { type?: string }) {
    const completion = event as GPT_PromptCompletion
    if (completion.conversationId?.startsWith('support-')) {
        if (gptSockets.get(sender)?.role === 'producer') settlePendingPromptRequest(completion)
        return
    }
    settlePendingPromptRequest(completion)

    const clients = gpt.get(id)
    if (!clients) return

    const payload = JSON.stringify({ ...event, timestamp: new Date().toISOString() })
    for (const clientSocket of clients) {
        if (clientSocket !== sender && clientSocket.readyState === WS.OPEN) clientSocket.send(payload)
    }
}

function settlePendingPromptRequest(event: GPT_PromptCompletion) {
    if (!event.conversationId || (event.type !== 'prompt_complete' && event.type !== 'prompt_error')) return
    const pending = pendingPromptRequests.get(event.conversationId)
    if (!pending) return

    clearTimeout(pending.timeout)
    pendingPromptRequests.delete(event.conversationId)
    if (event.type === 'prompt_error') {
        pending.reject(new Error(event.error || 'Hanasand AI failed to generate a response.'))
        return
    }
    pending.resolve(event)
}
