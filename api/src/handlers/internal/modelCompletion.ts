import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { requestGptCompletion } from '#utils/ws/handleGptMessage.ts'

type Message = { role: 'system' | 'user' | 'assistant'; content: string }
type Body = { messages?: unknown }

export async function postInternalModelCompletion(req: FastifyRequest<{ Body: Body }>, res: FastifyReply) {
    const expected = process.env.SUPPORT_SERVICE_KEY
    const received = req.headers['x-support-service-key']
    if (!expected || expected.length < 32 || typeof received !== 'string'
        || Buffer.byteLength(received) !== Buffer.byteLength(expected)
        || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return res.code(403).send({ error: 'Forbidden.' })
    const messages = req.body?.messages
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 21
        || !messages.every(message => message && typeof message === 'object'
            && ['system', 'user', 'assistant'].includes((message as Message).role)
            && typeof (message as Message).content === 'string' && (message as Message).content.length <= 4000)) {
        return res.code(400).send({ error: 'Invalid completion request.' })
    }
    try {
        const completion = await requestGptCompletion('gpt', {
            conversationId: `service-${randomUUID()}`,
            maxTokens: 600,
            temperature: 0.3,
            messages: messages as Message[],
        }, 45_000)
        const content = completion.content?.trim()
        if (!content) return res.code(503).send({ error: 'The model returned an empty response.' })
        return res.send({ content: content.slice(0, 10_000) })
    } catch (error) {
        req.log.error({ err: error }, 'Internal model completion failed')
        return res.code(503).send({ error: 'The model is unavailable.' })
    }
}
