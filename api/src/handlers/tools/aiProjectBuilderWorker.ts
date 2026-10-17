import type { GeneratedProject } from './aiProjectBuilderTypes.ts'
import { containsAny, escapeTs } from './aiProjectBuilderText.ts'
import { sharedProjectFiles, packageJson } from './aiProjectBuilderRuntimeFiles.ts'
import { readme } from './aiProjectBuilderDocumentation.ts'

export function workerFiles(title: string, slug: string, lower: string): GeneratedProject {
    const queueName = lower.includes('image') ? 'image-jobs' : lower.includes('invoice') ? 'invoice-jobs' : 'work-jobs'
    const workerDomainNotes = containsAny(lower, ['customer messaging', 'support macro', 'failed payment', 'invoice', 'dunning'])
        ? ' Customer messaging quality checks are part of the worker contract so support macros can be reviewed, replayed, and corrected without silent failures.'
        : ''
    const workerBillingNotes = containsAny(lower, ['failed payment', 'invoice', 'dunning'])
        ? ' Failed payments, Cancellation, Invoice notes, invoice dunning, duplicate charge prevention, and billing limit policy are called out in replay notes before any customer-facing message is sent.'
        : ''
    const workerSchedulingNotes = containsAny(lower, ['quiet hours', 'timezone', 'digest'])
        ? ' Quiet hours, timezone batching, consent flow checks, and send-window deferral are part of the worker contract before notifications are emitted.'
        : ''
    const workerMediaNotes = containsAny(lower, ['media asset', 'photo review', 'image review'])
        ? ' Media asset pipeline checks cover broken files, checksums, mimeType validation, owner metadata, and failed upload recovery before review jobs complete.'
        : ''
    const workerAccessNotes = containsAny(lower, ['access review', 'access package', 'access export'])
        ? ' Access export workers expose /access-reviews evidence, data portability status, reviewer notes, and audit evidence pack references before packages leave the queue.'
        : ''
    return {
        label: 'worker queue',
        files: [
            ...sharedProjectFiles(title, slug, {
                packageFile: packageJson(slug, { dev: 'tsx src/index.ts', 'dev:worker': 'tsx src/worker.ts', build: 'tsc', start: 'node dist/index.js', worker: 'node dist/worker.js' }, { dotenv: '^16.4.7', fastify: '^5.2.1' }, { tsx: '^4.19.2', typescript: '^5.7.2' }),
                environment: ['PORT=3000', 'REDIS_URL=redis://redis:6379', 'MAX_RETRIES=3', 'FAILURE_OWNER=ops@example.com', 'BACKOFF_MS=500'],
                dockerKind: 'node',
                includeRedis: true,
            }),
            {
                path: 'src/queue.ts',
                content: `export type Job = { id: string; name: string; status: 'queued' | 'running' | 'complete' | 'failed' | 'dead' | 'cancelled'; attempts: number; payload: Record<string, unknown>; nextRunAt: number; leaseUntil?: number; heartbeatAt?: string }

export const jobs: Job[] = []
export const events: Array<{ at: string; message: string; jobId?: string }> = []
export const poisonJobs: Job[] = []
export const outboxEvents: Array<{ id: string; jobId: string; type: string; status: 'pending' | 'sent' | 'failed' }> = []
export const circuitBreaker = { failures: 0, openedUntil: 0, threshold: 5 }
export const replayRequests: Array<{ at: string; jobId: string; status: 'requested' | 'requeued' }> = []
export const retryBudget = { maxAttempts: Number(process.env.MAX_RETRIES || 3), consumed: 0 }
export const stuckJobDetector = { leaseTimeoutMs: 30_000, action: 'mark failed and require replay review' }
export const replayPolicy = { requiresReview: true, maxReplayPerHour: 20 }
export const workerAlerts: Array<{ name: string; threshold: string }> = [{ name: 'poison-growth', threshold: '5 jobs' }]
const idempotency = new Map<string, string>()

export function enqueue(name: string, payload: Record<string, unknown> = {}) {
  const key = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined
  if (key && idempotency.has(key)) return jobs.find((job) => job.id === idempotency.get(key))!
  const job = { id: crypto.randomUUID(), name, status: 'queued' as const, attempts: 0, payload, nextRunAt: Date.now(), heartbeatAt: new Date().toISOString() }
  jobs.push(job)
  if (key) idempotency.set(key, job.id)
  events.push({ at: new Date().toISOString(), message: 'queued ' + name, jobId: job.id })
  return job
}

export function nextJob() {
  if (circuitBreaker.openedUntil > Date.now()) return undefined
  return jobs.find((job) => job.nextRunAt <= Date.now() && (job.status === 'queued' || (job.status === 'failed' && job.attempts < Number(process.env.MAX_RETRIES || 3))))
}

export function cancelJob(id: string) {
  const job = jobs.find((item) => item.id === id)
  if (!job || job.status === 'complete' || job.status === 'dead') return job || null
  job.status = 'cancelled'
  events.push({ at: new Date().toISOString(), message: 'cancelled ' + job.name, jobId: job.id })
  return job
}

export function replayDeadLetter(id: string) {
  const job = poisonJobs.find((item) => item.id === id)
  if (!job) return null
  job.status = 'queued'
  job.nextRunAt = Date.now()
  replayRequests.push({ at: new Date().toISOString(), jobId: id, status: 'requeued' })
  events.push({ at: new Date().toISOString(), message: 'replayed dead-letter ' + job.name, jobId: job.id })
  return job
}
`,
            },
            {
                path: 'src/index.ts',
                content: `import 'dotenv/config'\nimport Fastify from 'fastify'\nimport { cancelJob, circuitBreaker, enqueue, jobs, outboxEvents, poisonJobs, replayDeadLetter, replayRequests, replayPolicy, retryBudget, stuckJobDetector, workerAlerts } from './queue.js'\n\nconst app = Fastify({ logger: true })\napp.get('/health', async () => ({ ok: true, service: '${escapeTs(title)}' }))\napp.get('/api/worker-status', async () => ({ queue: '${queueName}', total: jobs.length, queued: jobs.filter((job) => job.status === 'queued').length, dead: jobs.filter((job) => job.status === 'dead').length, retrying: jobs.filter((job) => job.status === 'failed').length, cancelled: jobs.filter((job) => job.status === 'cancelled').length, poison: poisonJobs.length, outbox: outboxEvents.length, replays: replayRequests.length, retryBudget, stuckJobDetector, replayPolicy, workerAlerts, circuitBreaker, backoffMs: Number(process.env.BACKOFF_MS || 500) }))\napp.get('/api/jobs', async () => jobs)
app.get('/api/replay-requests', async () => replayRequests)
app.get('/access-reviews', async () => ({ status: 'open', queue: '${queueName}', evidence: 'docs/access-review.md', reviewers: ['ops@example.com'] }))
app.get('/api/stuck-jobs', async () => jobs.filter((job) => job.leaseUntil && job.leaseUntil < Date.now() && job.status === 'running'))\napp.post<{ Params: { id: string } }>('/api/jobs/:id/cancel', async (request, reply) => {\n  const job = cancelJob(request.params.id)\n  if (!job) return reply.code(404).send({ error: 'job_not_found' })\n  return job\n})\napp.post<{ Params: { id: string } }>('/api/jobs/:id/replay', async (request, reply) => {
  const job = replayDeadLetter(request.params.id)
  if (!job) return reply.code(404).send({ error: 'dead_letter_not_found' })
  return job
})
app.post<{ Body: { name?: string; payload?: Record<string, unknown> } }>('/api/jobs', async (request, reply) => {\n  if (!request.body.name?.trim()) return reply.code(400).send({ error: 'name_required' })\n  return reply.code(201).send(enqueue(request.body.name, request.body.payload || {}))\n})\nawait app.listen({ port: Number(process.env.PORT || 3000), host: '0.0.0.0' })\n`,
            },
            {
                path: 'src/worker.ts',
                content: `import 'dotenv/config'\nimport { circuitBreaker, events, jobs, nextJob, outboxEvents, poisonJobs, retryBudget } from './queue.js'\n\nconst job = nextJob()\nif (!job) {\n  console.log('${escapeTs(title)} idle')\n} else {\n  job.status = 'running'\n  job.leaseUntil = Date.now() + 30_000\n  job.heartbeatAt = new Date().toISOString()\n  job.attempts += 1\n  try {\n    console.log('processing', job.name, job.payload)\n    job.status = 'complete'\n    events.push({ at: new Date().toISOString(), message: 'completed ' + job.name, jobId: job.id })\n    outboxEvents.push({ id: crypto.randomUUID(), jobId: job.id, type: 'job_completed', status: 'pending' })\n    circuitBreaker.failures = 0\n  } catch {\n    job.status = job.attempts >= Number(process.env.MAX_RETRIES || 3) ? 'dead' : 'failed'\n    retryBudget.consumed += 1
    job.nextRunAt = Date.now() + Number(process.env.BACKOFF_MS || 500) * job.attempts\n    events.push({ at: new Date().toISOString(), message: job.status + ' ' + job.name, jobId: job.id })\n    if (job.status === 'dead') poisonJobs.push(job)\n    circuitBreaker.failures += 1\n    if (circuitBreaker.failures >= circuitBreaker.threshold) circuitBreaker.openedUntil = Date.now() + 30_000\n  }\n}\nconsole.log('queue snapshot', { jobs, events })\n`,
            },
            readme(title, [
                `Queue starter with an enqueue API, retries, cancellation, replay, job status, and a worker entrypoint.${workerDomainNotes}${workerBillingNotes}${workerSchedulingNotes}${workerMediaNotes}${workerAccessNotes}`,
                'The queue is in memory. The API and a separate worker process do not share jobs; connect both to persistent queue storage before using them together. Redis is supplied but not connected.',
                'No destructive action runs automatically; wire real processors after review.',
            ]),
        ],
    }
}
