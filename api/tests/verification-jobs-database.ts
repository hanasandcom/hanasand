import { state } from './verification-jobs-state.ts'

export async function query(sql: string, params: unknown[] = []) {
    state.calls.push({ sql, params })
    if (sql.includes('INSERT INTO ai_verification_jobs')) return insertJob(params)
    if (sql.includes('WITH ranked AS')) return { rows: [] }
    if (sql.includes('SET queue_position = 0 WHERE status <> \'queued\'')) return { rows: [] }
    if (sql.includes('SET status = \'cancelled\'')) return cancelJob(params)
    if (sql.includes('UPDATE ai_verification_jobs') && sql.includes('SET status = \'running\'')) return claimJob()
    if (sql.includes('SELECT * FROM ai_verification_jobs WHERE id = $1 AND owner_id = $2')) {
        return { rows: [state.jobs.get(String(params[0]))].filter(Boolean) }
    }
    if (sql.includes('COUNT(*) FILTER')) return jobCounts()
    if (sql.includes('SELECT * FROM ai_verification_jobs WHERE id = $1')) return readWorkerJob(params)
    if (sql.includes('SET current_step = $2')) return updateStep(params)
    if (sql.includes('SET status = $2')) return transitionJob(sql, params)
    if (sql.includes('SET status = \'failed\'')) return failJob(sql, params)
    if (sql.includes('SET status = \'queued\'')) return retryJob(sql, params)
    throw new Error(`Unexpected SQL: ${sql}`)
}

function insertJob(params: unknown[]) {
    const [id, ownerId, workspaceKind, workspaceId, kind, priority, lane, maxRetries, targetUrl, deployUrl, requestId, metadata] = params
    state.jobs.set(String(id), {
        id, owner_id: ownerId, workspace_kind: workspaceKind, workspace_id: workspaceId, kind,
        status: 'queued', priority, lane, queue_position: 0, retry_count: 0, max_retries: maxRetries,
        current_step: 'Queued', target_url: targetUrl, deploy_url: deployUrl, request_id: requestId,
        artifacts: [], metadata: JSON.parse(String(metadata)), error: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        started_at: null, completed_at: null, cancelled_at: null,
    })
    return { rows: [] }
}

function cancelJob(params: unknown[]) {
    const job = state.jobs.get(String(params[0]))
    if (!job || job.owner_id !== params[1] || !['queued', 'running'].includes(job.status)) return { rows: [] }
    const now = new Date().toISOString()
    Object.assign(job, { status: 'cancelled', current_step: 'Cancelled', cancelled_at: now, completed_at: job.completed_at || now })
    return { rows: [job] }
}

function claimJob() {
    const job = [...state.jobs.values()].find(item => item.status === 'queued')
    if (!job) return { rows: [] }
    Object.assign(job, { status: 'running', current_step: 'Starting', started_at: new Date().toISOString() })
    if (state.existingErrorOnClaim) job.error = state.existingErrorOnClaim
    return { rows: [job] }
}

function jobCounts() {
    const jobs = [...state.jobs.values()]
    return { rows: [{
        queued: jobs.filter(job => job.status === 'queued').length,
        running: jobs.filter(job => job.status === 'running').length,
        failed: jobs.filter(job => job.status === 'failed').length,
        completed: jobs.filter(job => job.status === 'completed').length,
    }] }
}

function readWorkerJob(params: unknown[]) {
    const id = String(params[0])
    const job = state.jobs.get(id)
    state.workerStatusReads.push(id)
    if (state.cancelOnWorkerRead && job?.status === 'running') job.status = 'cancelled'
    return { rows: [job].filter(Boolean) }
}

function updateStep(params: unknown[]) {
    const job = state.jobs.get(String(params[0]))
    if (job?.status === 'running') job.current_step = params[1]
    return { rows: [] }
}

function transitionJob(sql: string, params: unknown[]) {
    const job = state.jobs.get(String(params[0]))
    state.terminalAttempts.push(String(params[0]))
    if (state.loseTerminalTransition && job?.status === 'running') {
        state.loseTerminalTransition = false
        Object.assign(job, { status: 'cancelled', current_step: 'Cancelled' })
        return { rows: [] }
    }
    if (job?.status === 'running' && sql.includes('AND status = \'running\'')) Object.assign(job, {
        status: params[1], current_step: params[2],
        artifacts: [...job.artifacts, ...JSON.parse(String(params[3]))], error: params[4],
        completed_at: new Date().toISOString(),
    })
    return { rows: job?.status === params[1] ? [{ id: job.id }] : [] }
}

function failJob(sql: string, params: unknown[]) {
    const job = state.jobs.get(String(params[0]))
    if (job?.status === 'running' && sql.includes('AND status = \'running\'')) {
        Object.assign(job, { status: 'failed', current_step: 'Failed', error: params[1] })
    }
    return { rows: [] }
}

function retryJob(sql: string, params: unknown[]) {
    const job = state.jobs.get(String(params[0]))
    if (job?.status === 'running' && sql.includes('AND status = \'running\'')) {
        Object.assign(job, { status: 'queued', retry_count: job.retry_count + 1, current_step: 'Retry queued', error: params[1] })
    }
    return { rows: job?.status === 'queued' ? [{ id: job.id }] : [] }
}
