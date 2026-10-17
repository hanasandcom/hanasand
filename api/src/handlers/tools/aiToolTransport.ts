import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

export async function optionalToolAuth(req: FastifyRequest, res: FastifyReply) {
    const authHeader = headerString(req.headers.authorization)
    if (!authHeader || authHeader === 'Bearer ') {
        return { valid: false, id: null as string | null }
    }

    return tokenWrapper(req, res)
}

export function headerString(value: unknown) {
    return Array.isArray(value) ? String(value[0] || '') : typeof value === 'string' ? value : null
}

export async function forwardAiToolToWorker(req: FastifyRequest, res: FastifyReply, workerBase: string) {
    if (req.headers['x-ai-tool-forwarded']) {
        return res.status(503).send({ error: 'Model worker forwarding loop.' })
    }

    try {
        const headers: Record<string, string> = { 'content-type': 'application/json', 'x-ai-tool-forwarded': '1' }
        for (const name of ['authorization', 'id', 'cookie']) {
            const value = headerString(req.headers[name])
            if (value) headers[name] = value
        }
        const response = await fetch(`${workerBase.replace(/\/$/, '')}/api/tools/ai`, {
            method: 'POST', headers, body: JSON.stringify(req.body), redirect: 'error', signal: AbortSignal.timeout(240_000),
        })
        return res.status(response.status).send(await response.json())
    } catch {
        return res.status(503).send({ status: 'retryable', error: 'The model worker is temporarily unavailable.' })
    }
}
