import run from '#db'
import { checkScheduledAutomationAccess } from './automationAccess.ts'
import { monitoringCheckDetails } from './monitoringCaseEvents.ts'
import { recordMonitoringOutcome } from './monitoringIssues.ts'
import type { AutomationRow } from './automationTypes.ts'
import { getCertificateFromError } from './automationNetwork.ts'
import { runAutomationAction } from './automationActions.ts'
import { nextRunAfterExecution } from './automationSchedule.ts'
import { runArtifacts } from './automationRunArtifacts.ts'

export async function executeAutomation(automation: AutomationRow) {
    if (automation.monitoring_type === 'push') {
        const pushMonitoring = await import('./pushMonitoring.ts')
        try {
            return await pushMonitoring.checkPushMonitor(automation.id)
        } catch (error) {
            await pushMonitoring.recordPushExecutionFailure(automation, error)
        }
        return
    }
    let accessGranted = false
    let actionCompleted = false
    let outcome: { kind: 'failure' | 'warning' | null, message: string }
    const runId = crypto.randomUUID()
    const startedAt = Date.now()
    await run(`
        INSERT INTO agent_automation_runs (id, automation_id, owner_id, status, check_details)
        VALUES ($1, $2, $3, 'running', $4::jsonb)
    `, [runId, automation.id, automation.owner_id, JSON.stringify(monitoringCheckDetails(automation))])

    try {
        await checkScheduledAutomationAccess({ actionType: automation.action_type, targetUrl: automation.target_url, organizationId: automation.organization_id, modelName: automation.model_name, notificationDestinations: automation.notification_destinations }, automation.owner_id)
        accessGranted = true
        const result = await runAutomationAction(automation)
        actionCompleted = true
        outcome = { kind: 'warning' in result && result.warning === true ? 'warning' : null, message: result.message }
        const durationMs = Date.now() - startedAt
        const nextRunAt = nextRunAfterExecution(automation)
        await run(`
            UPDATE agent_automation_runs
               SET status = 'completed',
                   result = $2,
                   provider = $3,
                   model = $4,
                   completed_at = NOW(),
                   duration_ms = $5,
                   warning = $6,
                   artifacts = $7::jsonb
             WHERE id = $1
        `, [runId, result.message, result.provider, result.model, durationMs, 'warning' in result && result.warning === true, JSON.stringify(runArtifacts(result.message, 'artifacts' in result && Array.isArray(result.artifacts) ? result.artifacts : []))])
        await run(`
            UPDATE agent_automations
               SET next_run_at = $2,
                   last_completed_at = NOW(),
                   last_status = CASE WHEN $8::BOOLEAN THEN 'warning' ELSE 'completed' END,
                   last_result = $3,
                   last_error = NULL,
                   consecutive_failures = 0,
                   paused_reason = NULL,
                   run_count = run_count + 1,
                   updated_at = NOW(),
                   certificate_status = $4,
                   certificate_subject = $5,
                   certificate_issuer = $6,
                   certificate_expires_at = $7
             WHERE id = $1
        `, [automation.id, nextRunAt, result.message, 'certificate' in result ? result.certificate.status : automation.certificate_status, 'certificate' in result ? result.certificate.subject : automation.certificate_subject, 'certificate' in result ? result.certificate.issuer : automation.certificate_issuer, 'certificate' in result ? result.certificate.expiresAt : automation.certificate_expires_at, 'warning' in result && result.warning === true])
    } catch (error) {
        // A failed save is not evidence that the checked service failed.
        // Let the scheduler report/recover the unfinished run without a false case event.
        if (actionCompleted && automation.action_type === 'agent_prompt') throw error
        const durationMs = Date.now() - startedAt
        const message = error instanceof Error ? error.message : 'Automation run failed.'
        const certificate = getCertificateFromError(error)
        outcome = { kind: 'failure', message }
        const nextRunAt = nextRunAfterExecution(automation)
        await run(`
            UPDATE agent_automation_runs
               SET status = 'failed',
                   error = $2,
                   completed_at = NOW(),
                   duration_ms = $3,
                   artifacts = $4::jsonb
             WHERE id = $1
        `, [runId, message, durationMs, JSON.stringify(runArtifacts(message))])
        await run(`
            UPDATE agent_automations
               SET status = CASE WHEN consecutive_failures + 1 >= 3 AND schedule_kind = 'interval' AND action_type <> 'agent_prompt' THEN 'paused' ELSE status END,
                   next_run_at = CASE WHEN consecutive_failures + 1 >= 3 AND schedule_kind = 'interval' AND action_type <> 'agent_prompt' THEN NULL ELSE $2::timestamptz END,
                   last_completed_at = NOW(),
                   last_status = 'failed',
                   last_error = $3,
                   consecutive_failures = consecutive_failures + 1,
                   paused_reason = CASE WHEN consecutive_failures + 1 >= 3 AND schedule_kind = 'interval' AND action_type <> 'agent_prompt' THEN 'Paused after 3 consecutive failures.' ELSE paused_reason END,
                   run_count = run_count + 1,
                   certificate_status = COALESCE($4, certificate_status),
                   certificate_subject = COALESCE($5, certificate_subject),
                   certificate_issuer = COALESCE($6, certificate_issuer),
                   certificate_expires_at = COALESCE($7, certificate_expires_at),
                   updated_at = NOW()
             WHERE id = $1
        `, [automation.id, nextRunAt, message, certificate?.status || null, certificate?.subject || null, certificate?.issuer || null, certificate?.expiresAt || null])
    }
    if (accessGranted && automation.action_type === 'agent_prompt') {
        await recordMonitoringOutcome(automation, runId, outcome.kind, outcome.message)
            .catch(error => console.error('Unable to record monitoring issue:', error))
    }
}
