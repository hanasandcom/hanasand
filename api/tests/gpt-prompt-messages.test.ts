import { expect, test } from 'bun:test'
import { WebSocket } from 'ws'
import { gpt, gptSockets, handleGptMessage, requestGptCompletion } from '../src/utils/ws/handleGptMessage.ts'

class Socket {
    readyState = WebSocket.OPEN
    sent: Record<string, unknown>[] = []
    send(payload: string) { this.sent.push(JSON.parse(payload)) }
}

function sendMessage(id: string, socket: Socket, message: Record<string, unknown>) {
    return handleGptMessage(id, socket as unknown as WebSocket, Buffer.from(JSON.stringify(message)))
}

function register(id: string, entries: Array<[Socket, GPT_SocketState]>) {
    gpt.set(id, new Set(entries.map(([socket]) => socket as unknown as WebSocket)))
    for (const [socket, state] of entries) gptSockets.set(socket as unknown as WebSocket, state)
}

test('prompt requests relay only to a matching open producer and return the established error envelope', async () => {
    const id = 'gpt-prompt-relay-test'
    const requester = new Socket()
    const producer = new Socket()
    const observer = new Socket()
    register(id, [
        [requester, { role: 'observer', clientName: null }],
        [producer, { role: 'producer', clientName: 'model-a' }],
        [observer, { role: 'observer', clientName: null }],
    ])
    const request = { type: 'prompt_request', conversationId: 'conversation-a', clientName: 'model-a', messages: [{ role: 'user', content: 'hello' }] }

    await sendMessage(id, requester, request)
    expect(producer.sent).toEqual([request])
    expect(requester.sent).toEqual([])
    expect(observer.sent).toEqual([])

    await sendMessage(id, requester, { ...request, conversationId: 'conversation-missing', clientName: 'model-b' })
    expect(requester.sent[0]).toMatchObject({
        type: 'prompt_error',
        conversationId: 'conversation-missing',
        clientName: 'model-b',
        error: 'Client model-b is not connected.',
    })
    expect(typeof requester.sent[0].timestamp).toBe('string')
})

test('completions resolve callers, broadcast public events, and keep support transcripts private', async () => {
    const id = 'gpt-prompt-completion-test'
    const producer = new Socket()
    const viewer = new Socket()
    register(id, [
        [producer, { role: 'producer', clientName: 'model-a' }],
        [viewer, { role: 'observer', clientName: null }],
    ])

    const publicCompletion = requestGptCompletion(id, {
        conversationId: 'conversation-public',
        messages: [{ role: 'user', content: 'hello' }],
    })
    expect(producer.sent[0]).toMatchObject({ type: 'prompt_request', conversationId: 'conversation-public' })
    const result = { type: 'prompt_complete', conversationId: 'conversation-public', content: 'done' }
    await sendMessage(id, producer, result)
    expect(await publicCompletion).toEqual(result)
    expect(viewer.sent[0]).toMatchObject({ ...result, timestamp: expect.any(String) })

    viewer.sent.length = 0
    const supportCompletion = requestGptCompletion(id, {
        conversationId: 'support-private',
        messages: [{ role: 'user', content: 'private' }],
    })
    const supportResult = { type: 'prompt_complete', conversationId: 'support-private', content: 'private answer' }
    await sendMessage(id, producer, supportResult)
    expect(await supportCompletion).toEqual(supportResult)
    expect(viewer.sent).toEqual([])
})
