import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import { supportError, supportText as text } from '#utils/support/adminSupportInput.ts'
import { requireAdminSupport } from '../auth.ts'
import { toSystemEvent } from './auditEventProjection.ts'
import { auditTimelineSummary } from './auditEntityTimeline.ts'
import { supportAuditFilterContract } from './auditFilterPackets.ts'
import { supportAuditExportProof, supportAuditCompliancePacket } from './auditExportPackets.ts'
import { supportAuditBridgeAdapterContract } from './auditBridgePackets.ts'
import { supportAuditTimelineReplayContract } from './auditReplayContracts.ts'
import { supportAuditCaseReplayExport } from './auditCaseReplayExport.ts'
import { supportAuditSupportWorkflowPacket, supportAuditWorkflowRollup } from './auditWorkflowSummary.ts'
import { supportAuditActionEvidenceRollup } from './auditEvidenceRollups.ts'
import { supportAuditEventDecisionPacket } from './auditDecisionPackets.ts'
import { encodeAuditCursor, prepareSystemEventSearch, type SystemEventQuery } from './systemEventSearchPlan.ts'

export async function getSystemEvents(req: FastifyRequest, res: FastifyReply) {
    const started = performance.now()
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const query = req.query as SystemEventQuery
    if (query.format !== undefined && !['timeline', 'helpdesk'].includes(query.format)) return res.status(400).send(supportError('invalid_format', 'Unknown audit format.'))
    const timelineOnly = query.format === 'timeline'
    const helpdeskOnly = query.format === 'helpdesk'
    if (helpdeskOnly && query.hql !== undefined) return res.status(400).send(supportError('invalid_hql', 'HQL is not supported by the helpdesk format.'))
    const authorized = performance.now()
    const plan = prepareSystemEventSearch(query)
    if ('error' in plan) return res.status(400).send(plan.error)
    const {
        compiled, where, values, add, q, org, actorFilter, target, action, severity, source,
        service, entity, entityType, request, correlation, idempotency, supportSession,
        workflow, blocker, reason, scope, contextFilter, outcome, from, to, limit, page, cursor,
    } = plan
    // Timeline batches retain the first page total; support clients keep their existing contract.
    const countResult = helpdeskOnly || (timelineOnly && cursor) ? null : await run(`
        SELECT COUNT(*)::int AS total
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `, [...values])
    if (compiled) {
        const selected = compiled.summarize
            ? `${compiled.fields[compiled.summarize]} AS value, COUNT(*)::int AS count`
            : Object.entries(compiled.fields).map(([name, sql]) => `${sql} AS "${name}"`).join(', ')
        const result = await run(`
            SELECT ${selected}
            FROM system_events e
            LEFT JOIN users actor ON actor.id = e.actor_id
            LEFT JOIN users target_user ON target_user.id = e.object_id
            LEFT JOIN organizations organization ON organization.id = e.organization_id
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ${compiled.summarize ? 'GROUP BY 1 ORDER BY count DESC, value ASC NULLS LAST' : `ORDER BY ${compiled.order}`}
            LIMIT ${add(compiled.limit)}
        `, values)
        const columns = compiled.summarize ? [compiled.summarize, 'Count'] : compiled.projection || Object.keys(compiled.fields)
        return res.send({
            events: [],
            queryResult: {
                columns,
                rows: result.rows.map(row => compiled.summarize ? [row.value, row.count] : columns.map(column => row[column])),
                limit: compiled.limit,
                summarized: !!compiled.summarize,
            },
            pagination: { total: Number(countResult!.rows[0].total), nextCursor: null },
        })
    }
    if (cursor) {
        where.push(`(e.created_at, e.id) < (${add(cursor.createdAt)}, ${add(cursor.id)})`)
    }

    const result = await run(`
        SELECT ${timelineOnly ? `
            e.id, e.created_at, e.event_type, e.severity, e.service, e.source,
            e.actor_id, actor.name AS actor_name, e.object_id, e.object_type,
            target_user.name AS target_name, e.organization_id, organization.name AS organization_name,
            e.subject_id, e.request_id, e.outcome, e.reason,
            jsonb_strip_nulls(jsonb_build_object(
                'name', CASE WHEN jsonb_typeof(e.context->'name') = 'string' THEN e.context->'name' END,
                'targetName', CASE WHEN jsonb_typeof(e.context->'targetName') = 'string' THEN e.context->'targetName' END,
                'targetId', CASE WHEN jsonb_typeof(e.context->'targetId') = 'string' THEN e.context->'targetId' END,
                'targetSource', CASE WHEN jsonb_typeof(e.context->'targetSource') = 'string' THEN e.context->'targetSource' END
            )) AS context,
            e.ip, acknowledgement.acknowledged_at, acknowledgement.acknowledged_by,
            acknowledged_actor.name AS acknowledged_by_name
        ` : `
            e.id,
            e.event_type,
            e.severity,
            e.source,
            e.service,
            e.actor_id,
            actor.name AS actor_name,
            e.object_type,
            e.object_id,
            target_user.name AS target_name,
            e.organization_id,
            organization.name AS organization_name,
            e.subject_id,
            e.request_id,
            e.outcome,
            e.reason,
            ${helpdeskOnly ? `jsonb_strip_nulls(jsonb_build_object(
                'name', CASE WHEN jsonb_typeof(e.context->'name') = 'string' THEN e.context->'name' END,
                'targetName', CASE WHEN jsonb_typeof(e.context->'targetName') = 'string' THEN e.context->'targetName' END,
                'targetId', CASE WHEN jsonb_typeof(e.context->'targetId') = 'string' THEN e.context->'targetId' END,
                'targetSource', CASE WHEN jsonb_typeof(e.context->'targetSource') = 'string' THEN e.context->'targetSource' END
            )) AS context` : 'e.context'},
            e.ip,
            ${helpdeskOnly ? '\'\'::text AS user_agent' : 'e.user_agent'},
            acknowledgement.acknowledged_at,
            acknowledgement.acknowledged_by,
            acknowledged_actor.name AS acknowledged_by_name,
            e.created_at
        `}
        FROM system_events e
        LEFT JOIN users actor ON actor.id = e.actor_id
        LEFT JOIN users target_user ON target_user.id = e.object_id
        LEFT JOIN organizations organization ON organization.id = e.organization_id
        LEFT JOIN system_event_acknowledgments acknowledgement ON acknowledgement.event_id = e.id
        LEFT JOIN users acknowledged_actor ON acknowledged_actor.id = acknowledgement.acknowledged_by
        ${where.length ? `WHERE ${where.join('\n          AND ')}` : ''}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ${add(limit + 1)} OFFSET ${add((page - 1) * limit)}
    `, values)

    const pageRows = result.rows.slice(0, limit)
    const nextCursor = result.rows.length > limit && pageRows.length ? encodeAuditCursor(pageRows[pageRows.length - 1].created_at, pageRows[pageRows.length - 1].id) : null
    if (timelineOnly) {
        res.header('Server-Timing', `auth;dur=${(authorized - started).toFixed(2)}, query;dur=${(performance.now() - authorized).toFixed(2)}`)
        return res.send({
            events: pageRows,
            pagination: { total: countResult ? Number(countResult.rows[0].total) : null, nextCursor },
        })
    }
    if (helpdeskOnly) {
        res.header('Server-Timing', `auth;dur=${(authorized - started).toFixed(2)}, query;dur=${(performance.now() - authorized).toFixed(2)}`)
        return res.send({ events: pageRows })
    }
    const events = pageRows.map(toSystemEvent)
    const timeline = events.map(event => event.detail.timelineEvent)
    const filters = { q, org, actor: actorFilter, target, action, severity, source, service, entity, entityType, request, correlation, idempotency, supportSession, workflow, blocker, reason, scope, context: contextFilter, outcome, from, to, limit, cursor: text(query.cursor) }
    return res.send({
        events,
        pagination: {
            total: Number(countResult!.rows[0].total),
            limit,
            page,
            nextPage: result.rows.length > limit ? page + 1 : null,
            cursor: text(query.cursor) || null,
            nextCursor,
            previousCursor: null,
            appliedFilters: filters,
            sortField: 'createdAt',
            direction: 'desc',
        },
        filters,
        detail: {
            schemaVersion: 'admin.audit.timeline.v1',
            generatedAt: new Date().toISOString(),
            filters,
            summary: auditTimelineSummary(timeline),
            filterContract: supportAuditFilterContract(filters, timeline),
            exportProof: supportAuditExportProof(filters, timeline),
            compliancePacket: supportAuditCompliancePacket(filters, timeline),
            bridgeAdapter: supportAuditBridgeAdapterContract(filters),
            timelineReplayContract: supportAuditTimelineReplayContract(filters, timeline),
            caseReplayExport: supportAuditCaseReplayExport(filters, timeline),
            supportWorkflowPacket: supportAuditSupportWorkflowPacket(filters, timeline),
            workflowRollup: supportAuditWorkflowRollup(filters, timeline),
            actionEvidenceRollup: supportAuditActionEvidenceRollup(timeline),
            decisionPackets: events.slice(0, 50).map(event => supportAuditEventDecisionPacket({
                detail: event.detail || {},
                timelineEvent: event.detail?.timelineEvent || {},
                relatedTimeline: timeline,
                filters,
            })),
            timeline,
            copyText: events.slice(0, 20).map(event => event.detail.copyText).join('\n'),
        },
    })
}
