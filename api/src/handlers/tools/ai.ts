import type { FastifyReply, FastifyRequest } from 'fastify'
import { evaluateAgentActionPolicy, auditAgentAction } from '#utils/ai/actionPolicy.ts'
import { handleAiPrompt } from './aiPrompt.ts'
import type { AiToolRequest } from './aiToolContracts.ts'
import { forwardAiToolToWorker, headerString, optionalToolAuth } from './aiToolTransport.ts'

export { buildShareProjectResponse } from './aiProjectBuilder.ts'

export default async function aiTool(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
    res.header('Vary', 'Authorization, Cookie')

    // Only the scheduled worker owns model connections. Keep authentication,
    // policy decisions and inference together when called through an HTTP replica.
    const workerBase = process.env.AI_HEALTH_WORKER_BASE?.trim()
    if (workerBase) {
        return forwardAiToolToWorker(req, res, workerBase)
    }

    const body = req.body as AiToolRequest ?? {}
    const auth = await optionalToolAuth(req, res)
    if (req.headers.authorization && !auth.valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const actorId = auth.id || headerString(req.headers.id) || null

    if (body.action === 'audit_agent_action') {
        const actionInput = {
            action: body.toolAction || 'share_file_write',
            actorId,
            approved: Boolean(body.approved),
            approvalId: body.approvalId,
            target: body.target,
            path: body.path,
            content: body.content,
            metadata: body.metadata,
        }
        const decision = await evaluateAgentActionPolicy(actionInput)
        await auditAgentAction(req, actionInput, decision, decision.status === 'allowed' ? 'completed' : decision.status)
        if (decision.status === 'blocked') {
            return res.status(403).send({ error: decision.reason, decision })
        }
        if (decision.status === 'checkpoint_required') {
            return res.status(409).send({ error: decision.reason, decision })
        }
        return res.send({ ok: true, decision })
    }

    const { prompt } = body
    if (!prompt) {
        return res.status(400).send({ error: 'Missing prompt.' })
    }

    return handleAiPrompt(req, res, actorId, { ...body, prompt })
}
