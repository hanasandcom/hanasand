import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import {
    cleanOptional,
    boundedNumber,
    headerValue,
    isPlainObject,
    normalizeJob,
    normalizePriority,
    validateHttpUrl,
} from './model.ts'
import { getJobForOwner, queueSummary, updateQueuePositions } from './store.ts'
import { abortVerificationJob, scheduleVerificationQueue } from './queue.ts'
import type { CreateJobBody, VerificationJobRow } from './model.ts'

export async function postVerificationJob(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const body = (req.body || {}) as CreateJobBody
    const kind = body.kind || 'browser'
    if (!['browser', 'build', 'deploy', 'design'].includes(kind)) {
        return res.status(400).send({ error: 'Unsupported verification kind.' })
    }

    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : ''
    if (kind === 'browser' || kind === 'design') {
        const validation = validateHttpUrl(targetUrl)
        if (validation) {
            return res.status(400).send({ error: validation })
        }
    }

    const id = crypto.randomUUID()
    const requestId = headerValue(req.headers['x-request-id']) || crypto.randomUUID()
    const metadata = {
        ...(isPlainObject(body.metadata) ? body.metadata : {}),
        captureScreenshot: Boolean(body.captureScreenshot),
        timeoutMs: boundedNumber(body.timeoutMs || 16000, 16000, 1000, 30000),
    }
    const priority = normalizePriority(body.priority)
    const lane = typeof body.lane === 'string' && body.lane.trim() ? body.lane.trim().slice(0, 40) : priority > 0 ? 'priority' : 'standard'

    await run(`
        INSERT INTO ai_verification_jobs (
            id, owner_id, workspace_kind, workspace_id, kind, status, priority, lane,
            queue_position, max_retries, current_step, target_url, deploy_url, request_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, 0, $8, 'Queued', $9, $10, $11, $12::jsonb)
    `, [
        id,
        auth.id,
        cleanOptional(body.workspaceKind),
        cleanOptional(body.workspaceId),
        kind,
        priority,
        lane,
        boundedNumber(body.maxRetries ?? 1, 1, 0, 3),
        targetUrl || null,
        cleanOptional(body.deployUrl),
        requestId,
        JSON.stringify(metadata),
    ])
    await updateQueuePositions()
    scheduleVerificationQueue()

    const job = await getJobForOwner(id, auth.id)
    return res.status(202).send({ job: normalizeJob(job), queue: await queueSummary(auth.id) })
}

export async function getVerificationJobs(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const query = req.query as { workspaceKind?: string, workspaceId?: string, limit?: string }
    const limit = Math.max(1, Math.min(Number(query.limit || 20), 50))
    const params: unknown[] = [auth.id]
    const filters = ['owner_id = $1']
    if (query.workspaceKind) {
        params.push(query.workspaceKind)
        filters.push(`workspace_kind = $${params.length}`)
    }
    if (query.workspaceId) {
        params.push(query.workspaceId)
        filters.push(`workspace_id = $${params.length}`)
    }
    params.push(limit)
    const result = await run(`
        SELECT *
        FROM ai_verification_jobs
        WHERE ${filters.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${params.length}
    `, params as never[])
    return res.send({
        jobs: (result.rows as VerificationJobRow[]).map(normalizeJob),
        queue: await queueSummary(auth.id),
    })
}

export async function getVerificationJob(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const { id } = req.params as { id: string }
    const job = await getJobForOwner(id, auth.id)
    if (!job) {
        return res.status(404).send({ error: 'Verification job not found.' })
    }
    return res.send({ job: normalizeJob(job), queue: await queueSummary(auth.id) })
}

export async function cancelVerificationJob(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || !auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }
    const { id } = req.params as { id: string }
    const result = await run(`
        UPDATE ai_verification_jobs
        SET status = 'cancelled',
            current_step = 'Cancelled',
            cancelled_at = NOW(),
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
          AND owner_id = $2
          AND status IN ('queued', 'running')
        RETURNING *
    `, [id, auth.id])
    if (result.rows[0]) {
        abortVerificationJob(id)
    }
    await updateQueuePositions()
    const job = result.rows[0] || await getJobForOwner(id, auth.id)
    if (!job) {
        return res.status(404).send({ error: 'Verification job not found.' })
    }
    return res.send({ job: normalizeJob(job), queue: await queueSummary(auth.id) })
}

