import type { FastifyRequest } from 'fastify'
import run, { identityQueryOnce } from '#db'
import {
    cleanAuditDimension,
    cleanAuditReason,
    supportTimelineAuditBridgeEvent,
    type SupportTimelineAuditBridgeInput,
} from './systemEventBridge.ts'

export { cleanAuditReason, redactAuditValue, supportTimelineAuditBridgeEvent } from './systemEventBridge.ts'
export type { SupportTimelineAuditBridgeInput } from './systemEventBridge.ts'

export type SystemEventSeverity = 'info' | 'notice' | 'warning' | 'critical'
export type SystemEventOutcome = 'success' | 'denied' | 'failed'

export type SystemEventInput = {
    actionType: string
    actorId: string | null
    source?: string | null
    service?: string | null
    targetType?: string | null
    targetId?: string | null
    organizationId?: string | null
    entityId?: string | null
    severity?: SystemEventSeverity
    outcome?: SystemEventOutcome
    reason?: string | null
    requestId?: string | null
    context?: Record<string, unknown>
}

export function requireAuditReason(value: unknown, label = 'Reason') {
    const reason = cleanAuditReason(value)
    if (reason.length < 10) {
        throw new Error(`${label} must be at least 10 characters.`)
    }
    return reason
}

export async function recordSupportTimelineAuditBridgeEvent(req: FastifyRequest, input: SupportTimelineAuditBridgeInput) {
    await recordSystemEvent(req, supportTimelineAuditBridgeEvent(input))
}

export async function actorHasHanasandInternalAccess(actorId: string) {
    const result = await run(`
        SELECT 1
        FROM organization_members member
        JOIN organizations organization ON organization.id = member.organization_id
        JOIN users ON users.id = member.user_id
        WHERE member.user_id = $1 AND organization.id = $2
          AND organization.status = 'active' AND member.status = 'active'
          AND member.role IN ('owner', 'editor')
          AND users.active IS TRUE AND users.deletion_scheduled_at IS NULL
        LIMIT 1
    `, [actorId, '3e735e7b-4d7f-444d-9806-231fa26cfcec'])
    return result.rows.length > 0
}

export async function userHasHanasandInternalAccess(userId: string) {
    return actorHasHanasandInternalAccess(userId)
}

export async function recordSystemEvent(req: FastifyRequest, input: SystemEventInput, query: typeof run = run) {
    // system_events belongs to Identity. Writing through the API database's
    // foreign-table view loses the remote sequence default for its BIGSERIAL id.
    const write = process.env.HANASAND_IDENTITY_FDW_HOST ? identityQueryOnce : query
    const requestId = input.requestId || requestIdFrom(req)
    await write(`
        INSERT INTO system_events (
            event_type,
            severity,
            source,
            service,
            actor_id,
            object_type,
            object_id,
            organization_id,
            subject_id,
            request_id,
            outcome,
            reason,
            context,
            ip,
            user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
    `, [
        input.actionType,
        input.severity || 'info',
        cleanAuditDimension(input.source) || 'system',
        cleanAuditDimension(input.service) || 'hanasand-api',
        input.actorId,
        input.targetType || null,
        input.targetId || null,
        input.organizationId || null,
        input.entityId || input.targetId || input.organizationId || null,
        requestId,
        input.outcome || 'success',
        cleanAuditReason(input.reason),
        JSON.stringify(input.context || {}),
        req.ip,
        String(req.headers['user-agent'] || ''),
    ])
}

export async function loadSystemEventIds(input: { requestId: string, actionType: string, entityId: string }, query: typeof run = run) {
    const result = await query(`
        SELECT id
        FROM system_events
        WHERE request_id = $1
          AND event_type = $2
          AND subject_id = $3
        ORDER BY created_at DESC, id DESC
        LIMIT 10
    `, [input.requestId, input.actionType, input.entityId])
    return result.rows.map((row: Record<string, unknown>) => Number(row.id)).filter(id => Number.isFinite(id))
}

function requestIdFrom(req: FastifyRequest) {
    const header = req.headers['x-request-id']
    if (Array.isArray(header)) return header[0] || null
    return header || req.id || null
}
