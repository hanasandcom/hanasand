import { withTransaction } from '#db'

// Serialize pages that depend on shared event-time state. Independent process
// pages can run outside this lock because log and finding writes are idempotent.
let batchQueue: Promise<void> = Promise.resolve()

export function withLogBatch<T>(work: () => Promise<T>, transaction = withTransaction) {
    const previous = batchQueue
    let release!: () => void
    batchQueue = new Promise(resolve => { release = resolve })

    return previous.then(() => transaction(async query => {
        await query('SELECT pg_advisory_xact_lock(hashtextextended(\'event:log-batch\', 0))')
        return work()
    })).finally(release)
}
