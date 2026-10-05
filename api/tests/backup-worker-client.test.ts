import { afterAll, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { backupWorkerCall } from '../src/utils/db/backupWorkerClient.ts'

const previousUrl = process.env.DB_BACKUP_WORKER_URL
const previousToken = process.env.DB_BACKUP_WORKER_TOKEN
const targetDatabase = process.env.DB || 'hanasand'
const testPort = 18191
process.env.DB_BACKUP_WORKER_URL = 'http://127.0.0.1:18190'
process.env.DB_BACKUP_WORKER_TOKEN = 'unit-test-database-backup-token'
const calls: unknown[] = []
const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const input = JSON.parse(body)
    calls.push(input)
    expect(req.headers.authorization).toBe(`Bearer ${process.env.DB_BACKUP_WORKER_TOKEN}`)
    if (input.method === 'create') {
        res.writeHead(409).end(JSON.stringify({ error: 'Another backup is running.' }))
    } else if (input.method === 'restore-live') res.end(JSON.stringify({ value: { kind: 'restore_live', file: 'verified.dump' } }))
    else res.end(JSON.stringify({ value: [{ file: 'verified.dump' }] }))
})
await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(testPort, '127.0.0.1', resolve) })
process.env.DB_BACKUP_WORKER_URL = `http://127.0.0.1:${testPort}/`
afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()))
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
