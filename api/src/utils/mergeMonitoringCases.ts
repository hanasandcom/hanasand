import run, { withTransaction } from './db.ts'
import { correlationKey, monitoringScope } from './monitoringCorrelation.ts'
import type { AutomationRow } from './automations.ts'
import { monitoringIssueFingerprint } from './monitoringIssues.ts'
import { automationWriteScope } from './automationAccess.ts'
import { redactSecretBearingText } from './alerts/discordWebhookFile.ts'

type ManualMergeInput = {
    targetId: string
    sourceIds: string[]
    includeAll: boolean
    viewerId: string
    organizationId: string | null
    actor: string
    actorType: 'human' | 'automation'
}

const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const statusRank: Record<string, number> = { in_progress: 0, escalated: 0, open: 1, resolved: 2, closed: 3 }

// Merge a selected set from one health check. Alias rows remain addressable by
// their old HA id, while every event and comment is visible on the chosen case.
export async function mergeMonitoringCaseSet(input: ManualMergeInput) {
    const ids = [...new Set([input.targetId, ...input.sourceIds])]
    return withTransaction(async query => {
        const scoped = await query(`SELECT a.id, a.owner_id, a.organization_id
            FROM monitoring_issues i JOIN agent_automations a ON a.id=i.automation_id
            WHERE i.id=ANY($4::bigint[]) AND i.merged_into IS NULL
              AND ${automationWriteScope('a', '$1', '$2')}
              AND a.organization_id IS NOT DISTINCT FROM $3::text`, [input.includeAll, input.viewerId, input.organizationId, ids])
        if (scoped.rows.length !== ids.length) return null
        const lockKeys = [...new Set(scoped.rows.map(row => JSON.stringify([row.owner_id || row.id, row.organization_id || null])))].sort()
        for (const lockKey of lockKeys) await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey])
        const selected = await query(`SELECT i.*, a.name AS monitor_name, a.owner_id, a.organization_id,
                a.target_url, a.monitoring_type, a.json_rule, a.action_type, a.model_name, a.notification_destinations,
                a.expected_down, a.upside_down,
                COALESCE(i.status_override, CASE WHEN i.resolved_at IS NULL THEN 'open' ELSE 'resolved' END) AS effective_status,
                COALESCE(i.severity_override, CASE WHEN i.kind = 'failure' THEN 'high' ELSE 'medium' END) AS effective_severity
            FROM monitoring_issues i JOIN agent_automations a ON a.id=i.automation_id
            WHERE i.id=ANY($4::bigint[]) AND i.merged_into IS NULL
              AND ${automationWriteScope('a', '$1', '$2')}
              AND a.organization_id IS NOT DISTINCT FROM $3::text
            ORDER BY i.id FOR UPDATE OF i`, [input.includeAll, input.viewerId, input.organizationId, ids])
        if (selected.rows.length !== ids.length) return null
        const cases = selected.rows as Array<Record<string, any>>
        const target = cases.find(row => String(row.id) === input.targetId)
        if (!target || cases.some(row => row.automation_id !== target.automation_id)) {
            return { error: 'Select cases from the same monitoring check.' } as const
        }
        const sources = cases.filter(row => String(row.id) !== input.targetId)
        const sourceIds = sources.map(row => String(row.id))
        const sourceHistories = sources.flatMap(row => Array.isArray(row.history) ? row.history : [])
        const sourceComments = sources.flatMap(row => Array.isArray(row.comments) ? row.comments : [])
        const summaryRow = [...cases].sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())[0]!
        const targetFingerprint = monitoringIssueFingerprint(target as unknown as AutomationRow, target.kind, summaryRow.summary)
        const targetKey = await correlationKey(query, target as unknown as AutomationRow, targetFingerprint, target.kind, summaryRow.summary)
        const collision = await query('SELECT id FROM monitoring_issues WHERE correlation_key=$1 AND id<>$2 AND merged_into IS NULL FOR UPDATE', [targetKey, input.targetId])
        if (collision.rows.length && !sourceIds.includes(String(collision.rows[0].id))) {
            return { error: 'Refresh the case list and include the other case for this health check.' } as const
        }
        const effectiveStatuses = cases.map(row => String(row.effective_status))
        const mergeStatuses = effectiveStatuses.map(value => value === 'escalated' ? 'in_progress' : value)
        const effectiveSeverities = cases.map(row => String(row.effective_severity))
        const status = mergeStatuses.sort((a, b) => (statusRank[a] ?? 99) - (statusRank[b] ?? 99))[0] || 'open'
        const severity = effectiveSeverities.sort((a, b) => (severityRank[a] ?? 99) - (severityRank[b] ?? 99))[0] || 'medium'
        const hasActiveCase = effectiveStatuses.some(value => ['open', 'in_progress', 'escalated'].includes(value))
        const resolvedAt = hasActiveCase ? null : cases.map(row => row.resolved_at).filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null
        const resolutionRow = [...cases].filter(row => row.resolution || row.resolved_at).sort((a, b) => new Date(b.resolved_at || b.resolution?.at || 0).getTime() - new Date(a.resolved_at || a.resolution?.at || 0).getTime())[0]
        const details: Record<string, unknown>[] = []
        for (const row of cases) {
            const notificationState = (await query(`SELECT next_attempt_at,delivered_at,CASE WHEN last_error IS NULL THEN false ELSE true END AS failed,
                last_error,message_id,mentioned_everyone FROM monitoring_issue_notifications WHERE issue_id=$1 ORDER BY next_attempt_at`, [row.id])).rows
            details.push({
                caseId: `HA-${row.id}`, monitor: row.monitor_name, summary: row.summary,
                kind: row.kind, severity: row.effective_severity, status: row.effective_status,
                firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at,
                occurrences: Number(row.occurrences), resolution: row.resolution,
                diskDiagnostics: row.disk_diagnostics, notificationsEnabled: row.notifications_enabled,
                notificationState: notificationState.map((notice: Record<string, any>) => ({
                    nextAttemptAt: notice.next_attempt_at, deliveredAt: notice.delivered_at,
                    lastError: notice.last_error ? redactSecretBearingText(notice.last_error) : null,
                    messageId: notice.message_id, mentionedEveryone: notice.mentioned_everyone,
                })),
            })
        }
        const mergedComment = {
            id: crypto.randomUUID(), author: input.actor, actorType: input.actorType,
            createdAt: new Date().toISOString(),
            body: `Merged ${sources.map(row => `HA-${row.id}`).join(', ')} into HA-${target.id}. Original case fields are preserved below.\n\n${JSON.stringify(details, null, 2)}`,
        }
        const mergeEvent = {
            id: crypto.randomUUID(), at: new Date().toISOString(), actor: input.actor,
            actorType: input.actorType, action: 'cases_merged',
            note: `Merged ${sources.map(row => `HA-${row.id}`).join(', ')} into HA-${target.id}. Original summaries and field values are in the merged comment.`,
            mergedCases: details,
        }

        await query(`INSERT INTO monitoring_issue_checks(issue_id,automation_id,active)
            SELECT $2,automation_id,BOOL_OR(active) FROM monitoring_issue_checks WHERE issue_id=ANY($1::bigint[])
            GROUP BY automation_id
            ON CONFLICT(issue_id,automation_id) DO UPDATE SET active=monitoring_issue_checks.active OR EXCLUDED.active`, [sourceIds, input.targetId])
        await query('UPDATE agent_automation_runs SET issue_id=$2 WHERE issue_id=ANY($1::bigint[])', [sourceIds, input.targetId])
        await query('UPDATE monitoring_issue_messages SET issue_id=$2 WHERE issue_id=ANY($1::bigint[])', [sourceIds, input.targetId])
        await query(`INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at,last_error,message_id,mentioned_everyone)
            SELECT $2,destination,next_attempt_at,delivered_at,last_error,message_id,mentioned_everyone
            FROM (SELECT destination,MAX(next_attempt_at) AS next_attempt_at,MAX(delivered_at) AS delivered_at,
                MAX(last_error) AS last_error,MAX(message_id) AS message_id,BOOL_OR(mentioned_everyone IS TRUE) AS mentioned_everyone
                FROM monitoring_issue_notifications WHERE issue_id=ANY($1::bigint[]) GROUP BY destination) merged_notifications
            ON CONFLICT(issue_id,destination) DO UPDATE SET
                next_attempt_at=GREATEST(monitoring_issue_notifications.next_attempt_at,EXCLUDED.next_attempt_at),
                delivered_at=GREATEST(monitoring_issue_notifications.delivered_at,EXCLUDED.delivered_at),
                last_error=COALESCE(monitoring_issue_notifications.last_error,EXCLUDED.last_error),
                message_id=COALESCE(monitoring_issue_notifications.message_id,EXCLUDED.message_id),
                mentioned_everyone=COALESCE(monitoring_issue_notifications.mentioned_everyone,EXCLUDED.mentioned_everyone)`, [sourceIds, input.targetId])

        await query('UPDATE monitoring_issues SET correlation_key=NULL WHERE id=ANY($1::bigint[])', [sourceIds])
        const updated = await query(`UPDATE monitoring_issues t SET
                occurrences=$2, first_seen_at=$3, last_seen_at=$4, summary=$5, kind=$6,
                status_override=$7, severity_override=$8, resolved_at=$9, resolution=$10::jsonb,
                notifications_enabled=$11, comments=t.comments || $12::jsonb,
                history=t.history || $13::jsonb, disk_diagnostics=COALESCE(t.disk_diagnostics,$14::jsonb),
                correlation_key=$15
            WHERE t.id=$1 AND t.merged_into IS NULL
            RETURNING id`, [input.targetId, cases.reduce((sum, row) => sum + Number(row.occurrences || 0), 0),
            cases.map(row => row.first_seen_at).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0],
            cases.map(row => row.last_seen_at).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
            summaryRow.summary, cases.some(row => row.kind === 'failure') ? 'failure' : 'warning', status, severity,
            resolvedAt, resolvedAt ? JSON.stringify(resolutionRow?.resolution || target.resolution) : null,
            cases.every(row => row.notifications_enabled !== false), JSON.stringify([...sourceComments, mergedComment]),
            JSON.stringify([...sourceHistories.filter(event => !target.history?.some((existing: any) => existing.id === event.id)), mergeEvent]),
            JSON.stringify(cases.find(row => row.disk_diagnostics)?.disk_diagnostics || null), targetKey])
        if (!updated.rows.length) return null
        // Free the old per-sample keys before assigning the stable current key.
        await query('UPDATE monitoring_issues SET merged_into=$2,correlation_key=NULL WHERE id=ANY($1::bigint[])', [sourceIds, input.targetId])
        await query('UPDATE monitoring_issues SET merged_into=$2 WHERE merged_into=ANY($1::bigint[])', [sourceIds, input.targetId])
        if ((await query('SELECT to_regclass(\'public.case_development\') AS relation')).rows[0]?.relation) {
            await query(`UPDATE case_development SET case_references=array_append(case_references,$2)
                WHERE $1=ANY(case_references) AND NOT $2=ANY(case_references)`, [`HA-${sourceIds[0]}`, `HA-${input.targetId}`])
            for (const sourceId of sourceIds.slice(1)) await query(`UPDATE case_development SET case_references=array_append(case_references,$2)
                WHERE $1=ANY(case_references) AND NOT $2=ANY(case_references)`, [`HA-${sourceId}`, `HA-${input.targetId}`])
        }
        return { targetId: `HA-${input.targetId}`, mergedIds: sourceIds.map(id => `HA-${id}`) }
    })
}

// Run with the scheduled worker stopped. Keep old case rows as permanent aliases; never discard evidence.
export async function mergeMonitoringCases(automationIds?: string[]) {
    const roots = await run(`SELECT a.*, i.id AS case_id FROM monitoring_issues i JOIN agent_automations a ON a.id=i.automation_id
        WHERE i.merged_into IS NULL AND ($1::text[] IS NULL OR a.id=ANY($1)) ORDER BY i.first_seen_at, i.id`, [automationIds || null])
    const merged: Array<{ from: string, to: string }> = []
    for (const source of roots.rows) await withTransaction(async query => {
        const a = source as AutomationRow
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [monitoringScope(a)])
        const row = (await query('SELECT * FROM monitoring_issues WHERE id=$1 AND merged_into IS NULL FOR UPDATE', [source.case_id])).rows[0]
        if (!row) return
        const key = await correlationKey(query, a, monitoringIssueFingerprint(a, row.kind, row.summary), row.kind, row.summary)
        const canonical = (await query('SELECT * FROM monitoring_issues WHERE correlation_key=$1 AND id<>$2 FOR UPDATE', [key, row.id])).rows[0]
        if (!canonical) { await query('UPDATE monitoring_issues SET correlation_key=$2 WHERE id=$1', [row.id,key]); return }
        const ids = [row.id, canonical.id]
        await query(`INSERT INTO monitoring_issue_checks(issue_id,automation_id,active)
            SELECT $2,automation_id,active FROM monitoring_issue_checks WHERE issue_id=$1
            ON CONFLICT(issue_id,automation_id) DO UPDATE SET active=monitoring_issue_checks.active OR EXCLUDED.active`, ids)
        await query('UPDATE agent_automation_runs SET issue_id=$2 WHERE issue_id=$1', ids)
        await query('UPDATE monitoring_issue_messages SET issue_id=$2 WHERE issue_id=$1', ids)
        await query(`INSERT INTO monitoring_issue_notifications(issue_id,destination,next_attempt_at,delivered_at,last_error,message_id,mentioned_everyone)
            SELECT $2,destination,next_attempt_at,delivered_at,last_error,message_id,mentioned_everyone FROM monitoring_issue_notifications WHERE issue_id=$1
            ON CONFLICT(issue_id,destination) DO UPDATE SET next_attempt_at=GREATEST(monitoring_issue_notifications.next_attempt_at,EXCLUDED.next_attempt_at)`, ids)
        await query(`UPDATE monitoring_issues c SET occurrences=c.occurrences+d.occurrences,
            first_seen_at=LEAST(c.first_seen_at,d.first_seen_at), last_seen_at=GREATEST(c.last_seen_at,d.last_seen_at),
            summary=CASE WHEN d.last_seen_at>c.last_seen_at THEN d.summary ELSE c.summary END,
            resolved_at=CASE WHEN c.resolved_at IS NULL OR d.resolved_at IS NULL THEN NULL ELSE GREATEST(c.resolved_at,d.resolved_at) END,
            resolution=CASE WHEN c.status_override IS NOT NULL THEN c.resolution
                WHEN c.resolved_at IS NULL OR d.resolved_at IS NULL THEN NULL
                WHEN d.resolved_at>c.resolved_at THEN d.resolution ELSE c.resolution END,
            notifications_enabled=c.notifications_enabled AND d.notifications_enabled,
            comments=c.comments || d.comments, history=c.history || d.history || jsonb_build_array(jsonb_build_object(
                'id',gen_random_uuid()::text,'at',NOW(),'actor','Case correlation','actorType','automation','action','cases_merged',
                'note','Merged HA-' || d.id || ' into HA-' || c.id || ' because the technical indicators and access scope match. All underlying runs and messages were retained.'))
            FROM monitoring_issues d WHERE d.id=$1 AND c.id=$2`, ids)
        await query('UPDATE monitoring_issues SET merged_into=$2 WHERE merged_into=$1', ids)
        await query('UPDATE monitoring_issues SET merged_into=$2,correlation_key=NULL WHERE id=$1', ids)
        // Keep source workflow metadata on its alias as well as in the merged timeline.
        if ((await query('SELECT to_regclass(\'public.case_development\') AS relation')).rows[0]?.relation) {
            await query(`UPDATE case_development SET case_references=array_append(case_references,$2)
                WHERE $1=ANY(case_references) AND NOT $2=ANY(case_references)`, [`HA-${row.id}`,`HA-${canonical.id}`])
        }
        merged.push({ from: `HA-${row.id}`, to: `HA-${canonical.id}` })
    })
    return merged
}
