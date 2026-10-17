import type { FastifyRequest } from 'fastify'
import run from '#db'
import type { AgentPolicyDecision, AgentPolicyInput } from './actionPolicyTypes.ts'
import { redactAgentMetadata } from './actionPolicyRedaction.ts'

let ensuredAuditTable = false

export async function auditAgentAction(req: FastifyRequest, input: AgentPolicyInput, decision: AgentPolicyDecision, result: 'allowed' | 'blocked' | 'checkpoint_required' | 'completed' | 'failed' = decision.status) {
    try {
        await ensureAgentActionAuditTable()
        await run(`
            INSERT INTO ai_agent_action_audit (
                actor_id, authenticated_actor_id, action, target, risk, decision, approved,
                approval_id, hard_block, safe_alternative, reason, request_id, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        `, [
            input.actorId || null,
            typeof req.headers['x-authenticated-id'] === 'string' ? req.headers['x-authenticated-id'] : null,
            input.action,
            input.target || input.path || null,
            decision.risk,
            result,
            Boolean(input.approved),
            input.approvalId || null,
            decision.hardBlock,
            decision.safeAlternative,
            decision.reason,
            requestId(req),
            JSON.stringify(redactAgentMetadata({
                ...input.metadata,
                method: input.method,
                path: input.path,
            })),
        ])
    } catch (error) {
        req.log.error({ err: error }, 'Unable to write agent action audit event.')
    }
}

async function ensureAgentActionAuditTable() {
    if (ensuredAuditTable) {
        return
    }

    await run(`
        CREATE TABLE IF NOT EXISTS ai_agent_action_audit (
            id BIGSERIAL PRIMARY KEY,
            actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            authenticated_actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            target TEXT,
            risk TEXT NOT NULL,
            decision TEXT NOT NULL,
            approved BOOLEAN NOT NULL DEFAULT false,
            approval_id TEXT,
            hard_block BOOLEAN NOT NULL DEFAULT false,
            safe_alternative TEXT NOT NULL,
            reason TEXT NOT NULL,
            request_id TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_agent_action_audit_actor_created ON ai_agent_action_audit(actor_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_agent_action_audit_decision_created ON ai_agent_action_audit(decision, created_at DESC)')
    ensuredAuditTable = true
}

function requestId(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    return Array.isArray(header) ? header[0] || null : header || null
}
