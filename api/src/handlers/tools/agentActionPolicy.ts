import type { FastifyReply, FastifyRequest } from 'fastify'
import { auditAgentAction, evaluateAgentActionPolicy } from '#utils/ai/actionPolicy.ts'

type AgentPolicyInput = Parameters<typeof evaluateAgentActionPolicy>[0]

export async function applyAgentActionPolicy(req: FastifyRequest, res: FastifyReply, action: AgentPolicyInput) {
    const decision = await evaluateAgentActionPolicy(action)
    await auditAgentAction(req, action, decision)

    if (decision.status === 'blocked') {
        return res.status(403).send({ error: decision.reason, decision })
    }
    if (decision.status === 'checkpoint_required') {
        return res.status(409).send({ error: decision.reason, decision })
    }

    return null
}
