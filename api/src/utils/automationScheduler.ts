import run from '#db'
import type { AutomationRow } from './automationTypes.ts'
import { executeAutomation } from './automationExecution.ts'
import { runArtifacts } from './automationRunArtifacts.ts'

const STALE_RUNNING_AFTER_MS = 2 * 60_000

export async function runDueAutomations() {
    await recoverStaleAutomationRuns()
    await run('DELETE FROM monitoring_json_snapshots WHERE expires_at < NOW() - INTERVAL \'1 day\'')

    const claimResult = await run(`
        UPDATE agent_automations
           SET last_run_at = NOW(),
               last_status = 'running',
               last_error = NULL,
               updated_at = NOW()
         WHERE id IN (
            SELECT id
            FROM agent_automations
            WHERE status = 'active'
              AND next_run_at IS NOT NULL
              AND next_run_at <= NOW()
              AND COALESCE(last_status, '') <> 'running'
            ORDER BY next_run_at ASC
            LIMIT 100
            FOR UPDATE SKIP LOCKED
         )
         RETURNING *
    `)

    await Promise.all((claimResult.rows as AutomationRow[]).map(executeAutomation))
}

export async function recoverStaleAutomationRuns() {
    const staleAfter = new Date(Date.now() - STALE_RUNNING_AFTER_MS)
    await run(`
        UPDATE agent_automation_runs
           SET status = 'failed',
               error = 'Automation exceeded the maximum runtime and was recovered by the scheduler.',
               artifacts = $2::jsonb,
               completed_at = NOW(),
               duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INT * 1000
         WHERE status = 'running'
           AND started_at < $1
         RETURNING automation_id
    `, [staleAfter, JSON.stringify(runArtifacts('Automation exceeded the maximum runtime and was recovered by the scheduler.'))])


    await run(`
        UPDATE agent_automations automation
           SET last_status = 'failed',
               last_error = 'Automation exceeded the maximum runtime and was recovered by the scheduler.',
               last_completed_at = NOW(),
               last_run_at = NULL,
               next_run_at = CASE
                   WHEN automation.schedule_kind = 'interval' AND automation.status = 'active' THEN NOW()
                   ELSE automation.next_run_at
               END,
               consecutive_failures = consecutive_failures + 1,
               updated_at = NOW()
         WHERE automation.last_status = 'running'
           AND COALESCE(automation.last_run_at, automation.updated_at) < $1
           AND NOT EXISTS (
               SELECT 1 FROM agent_automation_runs live
               WHERE live.automation_id = automation.id AND live.status = 'running' AND live.started_at >= $1
           )
    `, [staleAfter])
}
