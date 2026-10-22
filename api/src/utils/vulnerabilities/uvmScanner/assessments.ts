import { randomUUID } from 'node:crypto'
import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import { ensureUvmSchema } from './shared.ts'
import {
    cancelUvmGvmRun, cancelUvmRun, startUvmGvmScan, startUvmNetworkScan, startUvmTenableScan,
} from './runs.ts'

const maxAssessmentAssets = 10
const engineIds = ['nmap', 'tenable-vm', 'gvm'] as const

export type UvmAssessmentEngine = typeof engineIds[number]
export type UvmAssessmentState = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled'
export type UvmAssessmentEngineSelection = { engine: UvmAssessmentEngine, scanId?: string }
export type UvmAssessmentInput = {
    requestId: string
    assetIds: string[]
    engines: UvmAssessmentEngineSelection[]
    authorized: boolean
}

type AssessmentRow = {
    id: string
    request_id: string
    status: UvmAssessmentState
    created_at: Date | string
    started_at: Date | string | null
    finished_at: Date | string | null
    actor_id: string
}
type StepRow = {
    id: string
    asset_id: string
    hostname: string | null
    engine: UvmAssessmentEngine
    profile: string
    run_id: string | null
    status: UvmAssessmentState
    error: string | null
    created_at: Date | string
    started_at: Date | string | null
    finished_at: Date | string | null
}

export async function ensureUvmAssessmentSchema() {
    await run(`CREATE TABLE IF NOT EXISTS uvm_assessments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        plan JSONB NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        UNIQUE (organization_id, request_id)
    )`)
    await run(`CREATE TABLE IF NOT EXISTS uvm_assessment_steps (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES uvm_assessments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES uvm_assets(id) ON DELETE RESTRICT,
        engine TEXT NOT NULL CHECK (engine IN ('nmap', 'tenable-vm', 'gvm')),
        profile TEXT NOT NULL,
        run_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        UNIQUE (assessment_id, asset_id, engine)
    )`)
    await run('CREATE INDEX IF NOT EXISTS uvm_assessments_org_created_idx ON uvm_assessments (organization_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS uvm_assessment_steps_assessment_idx ON uvm_assessment_steps (assessment_id, created_at)')
}

export function validateUvmAssessmentInput(value: unknown): UvmAssessmentInput | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const input = value as Record<string, unknown>
    const allowed = ['requestId', 'assetIds', 'engines', 'authorized']
    if (Object.keys(input).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(input, key))) return null
    if (typeof input.requestId !== 'string' || !isUuid(input.requestId)) return null
    if (!Array.isArray(input.assetIds) || input.assetIds.length < 1 || input.assetIds.length > maxAssessmentAssets
        || input.assetIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_.:@-]{1,200}$/.test(id))) return null
    const assetIds = [...new Set(input.assetIds as string[])].sort()
    if (assetIds.length !== input.assetIds.length) return null
    if (!Array.isArray(input.engines) || input.engines.length < 1 || input.engines.length > engineIds.length) return null
    const engines: UvmAssessmentEngineSelection[] = []
    for (const value of input.engines) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null
        const selection = value as Record<string, unknown>
        if (Object.keys(selection).some(key => !['engine', 'scanId'].includes(key))) return null
        if (typeof selection.engine !== 'string' || !engineIds.includes(selection.engine as UvmAssessmentEngine)) return null
        if (selection.engine !== 'tenable-vm' && Object.hasOwn(selection, 'scanId')) return null
        if (selection.engine === 'tenable-vm' && (typeof selection.scanId !== 'string' || !/^\d{1,12}$/.test(selection.scanId))) return null
        engines.push(selection.engine === 'tenable-vm' ? { engine: 'tenable-vm', scanId: selection.scanId as string } : { engine: selection.engine as 'nmap' | 'gvm' })
    }
    if (new Set(engines.map(selection => selection.engine)).size !== engines.length) return null
    if (typeof input.authorized !== 'boolean') return null
    engines.sort((left, right) => left.engine.localeCompare(right.engine))
    return { requestId: input.requestId.toLowerCase(), assetIds, engines, authorized: input.authorized }
}

export function assessmentPlanMatches(existing: unknown, expected: { assetIds: string[], engines: UvmAssessmentEngineSelection[] }) {
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return false
    const plan = existing as Record<string, unknown>
    if (!Array.isArray(plan.assetIds) || !Array.isArray(plan.engines)) return false
    const engineKey = (items: unknown[]) => items.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const selection = item as Record<string, unknown>
        return { engine: selection.engine, scanId: selection.scanId ?? null }
    }).sort((left, right) => String(left?.engine).localeCompare(String(right?.engine)))
    return JSON.stringify([...plan.assetIds].sort()) === JSON.stringify([...expected.assetIds].sort())
        && JSON.stringify(engineKey(plan.engines)) === JSON.stringify(engineKey(expected.engines))
}

export async function startUvmAssessment(value: unknown, actorId: string) {
    const input = validateUvmAssessmentInput(value)
    if (!input) throw new Error('assessment_invalid_request')
    await ensureUvmSchema()
    await ensureUvmAssessmentSchema()
    const plan = { assetIds: input.assetIds, engines: input.engines }
    const assessmentId = randomUUID()
    const inserted = await run(`INSERT INTO uvm_assessments (id, organization_id, request_id, actor_id, plan, status, started_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, 'running', NOW()) ON CONFLICT (organization_id, request_id) DO NOTHING RETURNING id`,
    [assessmentId, HANASAND_ORGANIZATION_ID, input.requestId, actorId, JSON.stringify(plan)])
    if (!inserted.rows[0]) {
        const existing = await run('SELECT id, plan FROM uvm_assessments WHERE organization_id = $1 AND request_id = $2', [HANASAND_ORGANIZATION_ID, input.requestId])
        if (!existing.rows[0]) throw new Error('assessment_create_failed')
        if (!assessmentPlanMatches(existing.rows[0].plan, plan)) throw new Error('assessment_request_conflict')
        return getUvmAssessment(existing.rows[0].id)
    }

    const jobs = input.assetIds.flatMap(assetId => input.engines.map(selection => ({ assetId, selection })))
    const plannedJobs = []
    for (const job of jobs) {
        const stepId = randomUUID()
        const profile = job.selection.engine === 'nmap' ? 'tcp-top-100' : job.selection.engine === 'gvm' ? 'Full and Fast' : job.selection.scanId!
        await run(`INSERT INTO uvm_assessment_steps (id, assessment_id, organization_id, asset_id, engine, profile, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'queued')`,
        [stepId, assessmentId, HANASAND_ORGANIZATION_ID, job.assetId, job.selection.engine, profile])
        plannedJobs.push({ ...job, stepId })
    }
    for (const job of plannedJobs) {
        const { stepId } = job
        try {
            const started = job.selection.engine === 'nmap'
                ? await startUvmNetworkScan({ assetId: job.assetId, actorId, source: 'manual', authorized: input.authorized })
                : job.selection.engine === 'gvm'
                    ? await startUvmGvmScan({ assetId: job.assetId, actorId, authorized: input.authorized })
                    : await startUvmTenableScan({ assetId: job.assetId, actorId, scanId: job.selection.scanId!, source: 'manual', authorized: input.authorized })
            await run(`UPDATE uvm_assessment_steps SET run_id = $2, status = $3, started_at = $4
                WHERE id = $1 AND organization_id = $5`,
            [stepId, started.id, persistedStatus(started.status), started.startedAt || null, HANASAND_ORGANIZATION_ID])
        } catch (error) {
            await run(`UPDATE uvm_assessment_steps SET status = 'failed', error = $2, finished_at = NOW()
                WHERE id = $1 AND organization_id = $3`, [stepId, readableError(error), HANASAND_ORGANIZATION_ID])
        }
    }
    await refreshAssessmentStatus(assessmentId)
    return getUvmAssessment(assessmentId)
}

export async function listUvmAssessments(limit = 25) {
    await ensureUvmAssessmentSchema()
    const assessments = await run(`SELECT id, request_id, status, created_at, started_at, finished_at, actor_id
        FROM uvm_assessments WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`, [HANASAND_ORGANIZATION_ID, Math.max(1, Math.min(limit, 50))]) as { rows: AssessmentRow[] }
    const items = []
    for (const assessment of assessments.rows) items.push(await getUvmAssessment(assessment.id))
    return items.filter(Boolean)
}

export async function getUvmAssessment(assessmentId: string) {
    await ensureUvmAssessmentSchema()
    const assessment = await run('SELECT id, request_id, status, created_at, started_at, finished_at, actor_id FROM uvm_assessments WHERE id = $1 AND organization_id = $2', [assessmentId, HANASAND_ORGANIZATION_ID]) as { rows: AssessmentRow[] }
    const row = assessment.rows[0]
    if (!row) return null
    const steps = await run(`SELECT s.id, s.asset_id, a.hostname, s.engine, s.profile, s.run_id, s.status, s.error,
            s.created_at, s.started_at, s.finished_at
        FROM uvm_assessment_steps s JOIN uvm_assets a ON a.id = s.asset_id
        WHERE s.assessment_id = $1 AND s.organization_id = $2 ORDER BY s.created_at, s.id`, [assessmentId, HANASAND_ORGANIZATION_ID]) as { rows: StepRow[] }
    return {
        id: row.id,
        requestId: row.request_id,
        status: row.status,
        createdAt: row.created_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        jobs: steps.rows.map(step => ({
            id: step.id, assetId: step.asset_id, asset: step.hostname, engine: step.engine, profile: step.profile,
            runId: step.run_id, status: step.status, error: step.error, createdAt: step.created_at,
            startedAt: step.started_at, finishedAt: step.finished_at,
        })),
    }
}

export async function cancelUvmAssessment(assessmentId: string) {
    const assessment = await getUvmAssessment(assessmentId)
    if (!assessment) return null
    if (!['queued', 'running'].includes(assessment.status)) return assessment
    const active = assessment.jobs.filter((job: { status: string }) => ['queued', 'running'].includes(job.status))
    for (const job of active) {
        if (!job.runId) {
            await run(`UPDATE uvm_assessment_steps SET status = 'cancelled', error = 'Cancelled before scanner submission.', finished_at = NOW()
                WHERE id = $1 AND organization_id = $2 AND status = 'queued'`, [job.id, HANASAND_ORGANIZATION_ID])
            continue
        }
        try {
            const result = job.engine === 'gvm' ? await cancelUvmGvmRun(job.runId) : await cancelUvmRun(job.runId)
            await run(`UPDATE uvm_assessment_steps SET status = $2, finished_at = CASE WHEN $2 IN ('cancelled', 'failed', 'succeeded', 'partial') THEN NOW() ELSE finished_at END
                WHERE id = $1 AND organization_id = $3`, [job.id, persistedStatus(result?.status || 'cancelled'), HANASAND_ORGANIZATION_ID])
        } catch (error) {
            await run('UPDATE uvm_assessment_steps SET error = $2 WHERE id = $1 AND organization_id = $3', [job.id, readableError(error), HANASAND_ORGANIZATION_ID])
        }
    }
    await refreshAssessmentStatus(assessmentId)
    return getUvmAssessment(assessmentId)
}

export async function reconcileUvmAssessments() {
    await ensureUvmAssessmentSchema()
    await run(`UPDATE uvm_assessment_steps SET status = 'failed', error = 'Assessment launch was interrupted before scanner submission.', finished_at = NOW()
        WHERE organization_id = $1 AND status = 'queued' AND run_id IS NULL AND created_at < NOW() - INTERVAL '5 minutes'`, [HANASAND_ORGANIZATION_ID])
    await run(`UPDATE uvm_assessment_steps s SET status = r.status, error = r.error,
            started_at = COALESCE(s.started_at, r.started_at),
            finished_at = CASE WHEN r.status IN ('succeeded', 'partial', 'failed', 'cancelled') THEN COALESCE(s.finished_at, r.finished_at, NOW()) ELSE s.finished_at END
        FROM uvm_network_runs r
        WHERE s.organization_id = $1 AND s.engine = 'nmap' AND s.run_id = r.id AND r.organization_id = $1`, [HANASAND_ORGANIZATION_ID])
    await run(`UPDATE uvm_assessment_steps s SET status = r.status, error = r.error,
            started_at = COALESCE(s.started_at, r.started_at),
            finished_at = CASE WHEN r.status IN ('succeeded', 'partial', 'failed', 'cancelled') THEN COALESCE(s.finished_at, r.finished_at, NOW()) ELSE s.finished_at END
        FROM uvm_tenable_runs r
        WHERE s.organization_id = $1 AND s.engine = 'tenable-vm' AND s.run_id = r.id AND r.organization_id = $1`, [HANASAND_ORGANIZATION_ID])
    // GVM runs are owned by Scanner and are refreshed in the reconciliation path.
    const active = await run('SELECT id FROM uvm_assessments WHERE organization_id = $1 AND status IN (\'queued\', \'running\') ORDER BY created_at LIMIT 100', [HANASAND_ORGANIZATION_ID]) as { rows: Array<{ id: string }> }
    for (const row of active.rows) await refreshAssessmentStatus(row.id)
    return { reconciled: active.rows.length }
}

async function refreshAssessmentStatus(assessmentId: string) {
    const result = await run('SELECT status FROM uvm_assessment_steps WHERE assessment_id = $1 AND organization_id = $2', [assessmentId, HANASAND_ORGANIZATION_ID]) as { rows: Array<{ status: string }> }
    const statuses = result.rows.map(row => row.status)
    const active = statuses.some(status => ['queued', 'running'].includes(status))
    const completed = statuses.length > 0 && statuses.every(status => ['succeeded', 'partial', 'failed', 'cancelled'].includes(status))
    const successCount = statuses.filter(status => status === 'succeeded').length
    const partialCount = statuses.filter(status => status === 'partial').length
    const cancelledCount = statuses.filter(status => status === 'cancelled').length
    const status: UvmAssessmentState = active ? 'running'
        : completed && successCount === statuses.length ? 'succeeded'
            : completed && successCount + partialCount > 0 ? 'partial'
                : completed && cancelledCount === statuses.length ? 'cancelled'
                    : 'failed'
    const finished = !active
    await run(`UPDATE uvm_assessments SET status = $2, finished_at = CASE WHEN $3 THEN COALESCE(finished_at, NOW()) ELSE NULL END
        WHERE id = $1 AND organization_id = $4`, [assessmentId, status, finished, HANASAND_ORGANIZATION_ID])
}

function persistedStatus(status: string): UvmAssessmentState {
    if (['launching', 'exporting', 'cancelling'].includes(status)) return 'running'
    if (['queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled'].includes(status)) return status as UvmAssessmentState
    return 'failed'
}

function readableError(error: unknown) {
    return error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000)
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
