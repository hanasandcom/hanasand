import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { automationAccessError } from '#utils/automationAccess.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { normalizeAutomationInput, toAutomation, type AutomationInput, type AutomationRow } from '#utils/automations.ts'
import { activeAutomationLimitError, canManageAllAutomations } from './automationHandlerSupport.ts'
import { loadAutomation } from './automationReads.ts'

export async function postAutomation(req: FastifyRequest<{ Body: AutomationInput }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    let input
    try {
        input = normalizeAutomationInput(req.body)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid automation.' })
    }

    const manageAll = await canManageAllAutomations(req)
    const accessError = await automationAccessError(input, ownerId, manageAll)
    if (accessError) return res.status(403).send({ error: accessError })
    if (input.status === 'active' && !manageAll) {
        const limitError = await activeAutomationLimitError(ownerId)
        if (limitError) {
            return res.status(409).send({ error: limitError })
        }
    }

    const id = crypto.randomUUID()
    const result = await run(`
        INSERT INTO agent_automations (
            id,
            owner_id,
            name,
            prompt,
            target_url,
            monitoring_type,
            follow_redirects,
            user_agent,
            expected_down,
            upside_down,
            timeout_seconds,
            retry_count,
            schedule_kind,
            interval_minutes,
            run_at,
            status,
            action_type,
            organization_id,
            timezone,
            model_name,
            notify_on,
            notify_warnings,
            next_run_at,
            notification_destinations, json_rule
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb)
        RETURNING *
    `, [
        id,
        ownerId,
        input.name,
        input.prompt,
        input.targetUrl,
        input.monitoringType,
        input.followRedirects,
        input.userAgent,
        input.expectedDown,
        input.upsideDown,
        input.timeoutSeconds,
        input.retryCount,
        input.scheduleKind,
        input.intervalMinutes,
        input.runAt,
        input.status,
        input.actionType,
        input.organizationId,
        input.timezone,
        input.modelName,
        input.notifyOn,
        input.notifyWarnings,
        input.nextRunAt,
        input.notificationDestinations,
        JSON.stringify(input.jsonRule),
    ])

    return res.status(201).send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

export async function putAutomation(req: FastifyRequest<{ Params: { id: string }, Body: AutomationInput }>, res: FastifyReply) {
    const { valid, id: ownerId } = await tokenWrapper(req, res)
    if (!valid || !ownerId) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const manageAll = await canManageAllAutomations(req)
    const existing = await loadAutomation(req.params.id, ownerId, manageAll, true)
    if (!existing) {
        return res.status(404).send({ error: 'Automation not found.' })
    }

    let input
    try {
        input = normalizeAutomationInput(req.body, existing)
    } catch (error) {
        return res.status(400).send({ error: error instanceof Error ? error.message : 'Invalid automation.' })
    }

    const accessError = await automationAccessError(input, ownerId, manageAll)
    if (accessError) return res.status(403).send({ error: accessError })
    if ((existing.monitoring_type === 'push' || input.monitoringType === 'push')
        && (existing.monitoring_type !== input.monitoringType || existing.target_url !== input.targetUrl)) {
        return res.status(400).send({ error: 'Create a separate check when changing an external source or check type.' })
    }
    if (input.status === 'active' && existing.status !== 'active' && !manageAll) {
        const limitError = await activeAutomationLimitError(existing.owner_id, req.params.id)
        if (limitError) {
            return res.status(409).send({ error: limitError })
        }
    }

    const result = await run(`
        UPDATE agent_automations
           SET name = $3,
               prompt = $4,
               target_url = $5,
               monitoring_type = $6,
               follow_redirects = $7,
               user_agent = $8,
               expected_down = $9,
               upside_down = $10,
               timeout_seconds = $11,
               retry_count = $12,
               schedule_kind = $13,
               interval_minutes = $14,
               run_at = $15,
               status = $16,
               action_type = $17,
               organization_id = $18,
               timezone = $19,
               model_name = $20,
               notify_on = $21,
               notify_warnings = $22,
               next_run_at = $23,
               notification_destinations = $24,
               json_rule = $26::jsonb,
               consecutive_failures = CASE WHEN $16 = 'active' THEN 0 ELSE consecutive_failures END,
               paused_reason = CASE WHEN $16 = 'active' THEN NULL ELSE paused_reason END,
               last_status = CASE WHEN last_status = 'running' THEN NULL ELSE last_status END,
               updated_at = NOW()
         WHERE id = $1
           AND ($2::BOOLEAN OR owner_id = $25)
         RETURNING *
    `, [
        req.params.id,
        manageAll,
        input.name,
        input.prompt,
        input.targetUrl,
        input.monitoringType,
        input.followRedirects,
        input.userAgent,
        input.expectedDown,
        input.upsideDown,
        input.timeoutSeconds,
        input.retryCount,
        input.scheduleKind,
        input.intervalMinutes,
        input.runAt,
        input.status,
        input.actionType,
        input.organizationId,
        input.timezone,
        input.modelName,
        input.notifyOn,
        input.notifyWarnings,
        input.nextRunAt,
        input.notificationDestinations,
        ownerId,
        JSON.stringify(input.jsonRule),
    ])

    return res.send({ automation: toAutomation(result.rows[0] as AutomationRow) })
}

