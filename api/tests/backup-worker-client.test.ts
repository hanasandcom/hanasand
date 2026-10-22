import { afterAll, expect, test } from 'bun:test'
import { backupWorkerCall } from '../src/utils/db/backupWorkerClient.ts'

const previousUrl = process.env.DB_BACKUP_WORKER_URL
const previousToken = process.env.DB_BACKUP_WORKER_TOKEN
const previousFetch = globalThis.fetch
const targetDatabase = process.env.DB || 'hanasand'
process.env.DB_BACKUP_WORKER_URL = 'http://backup-worker.test/'
process.env.DB_BACKUP_WORKER_TOKEN = 'unit-test-database-backup-token'
const calls: unknown[] = []
globalThis.fetch = (async (input, init) => {
    expect(String(input)).toBe('http://backup-worker.test')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${process.env.DB_BACKUP_WORKER_TOKEN}`)
    const inputBody = JSON.parse(String(init?.body))
    calls.push(inputBody)
    if (inputBody.method === 'create') {
        return Response.json({ error: 'Another backup is running.' }, { status: 409 })
    }
    if (inputBody.method === 'restore-live') return Response.json({ value: { kind: 'restore_live', file: 'verified.dump' } })
    return Response.json({ value: [{ file: 'verified.dump' }] })
}) as typeof fetch
afterAll(() => {
    globalThis.fetch = previousFetch
    if (previousUrl === undefined) delete process.env.DB_BACKUP_WORKER_URL
    else process.env.DB_BACKUP_WORKER_URL = previousUrl
    if (previousToken === undefined) delete process.env.DB_BACKUP_WORKER_TOKEN
    else process.env.DB_BACKUP_WORKER_TOKEN = previousToken
})
test('API delegates backup reads without touching worker state', async () => {
    const { listDatabaseBackupFiles } = await import('../src/utils/db/backups.ts')
    expect(await listDatabaseBackupFiles('hanasand')).toEqual([{ file: 'verified.dump' }])
    expect(calls[0]).toEqual({ method: 'files', args: ['hanasand', null] })
})
test('worker conflicts preserve their status and do not fall back to local exports', async () => {
    const error = await backupWorkerCall('create', [{}]).catch(error => error)
    expect(error.statusCode).toBe(409)
    expect(error.message).toBe('Another backup is running.')
})
test('live restore requests are sent to the dedicated backup worker operation', async () => {
    const { restoreDatabaseBackupToLive } = await import('../src/utils/db/backups.ts')
    const result = await restoreDatabaseBackupToLive({ file: 'verified.dump', confirmation: `RESTORE ${targetDatabase}`, actorId: 'admin-1' })
    expect(result).toEqual({ kind: 'restore_live', file: 'verified.dump' })
    expect(calls.at(-1)).toEqual({
        method: 'restore-live',
        args: [{ file: 'verified.dump', confirmation: `RESTORE ${targetDatabase}`, actorId: 'admin-1' }],
    })
})
