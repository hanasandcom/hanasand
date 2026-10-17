import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { automationWriteScope } from '#utils/automationAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { executeAutomation, toAutomation, type AutomationRow } from '#utils/automations.ts'
import { canManageAllAutomations } from './automationHandlerSupport.ts'
import { loadAutomation } from './automationReads.ts'

export async function deleteAutomation(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const manageAll = await canManageAllAutomations(req)
    const result = await run(`
        UPDATE agent_automations
           SET status = 'archived',
               next_run_at = NULL,
               updated_at = NOW()
         WHERE id = $1
           AND ${automationWriteScope('agent_automations', '$2', '$3')}
         RETURNING *
    `, [req.params.id, manageAll, ownerId])

    if (!result.rows.length) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    if (result.rows[0].monitoring_type === 'push') {
        await run(`UPDATE api_keys SET enabled=FALSE, updated_at=NOW()
            WHERE id IN (SELECT api_key_id FROM monitoring_push_sources WHERE automation_id=$1)`, [req.params.id])
    }

    return res.send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function postAutomationRunNow(req: FastifyRequest<{ Params: { id: string } }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const automation = await loadAutomation(req.params.id, ownerId, await canManageAllAutomations(req), true)
    if (!automation) {
        return res.status(404).send({ error: 'Automation not found.' })
    }
    if (automation.status !== 'active') return res.status(409).send({ error: 'Resume this check before running it.' })

    const claim = await run(`
        UPDATE agent_automations
           SET last_status = 'running',
               last_run_at = NOW(),
               last_error = NULL,
               updated_at = NOW()
         WHERE id = $1
           AND status = 'active'
           AND last_status IS DISTINCT FROM 'running'
         RETURNING *
    `, [automation.id])
    if (!claim.rows.length) return res.status(409).send({ error: 'This check is already running.' })
    void executeAutomation(claim.rows[0] as AutomationRow)

    return res.status(202).send({ ok: true, message: 'Automation run queued.' })
}

