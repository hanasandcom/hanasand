import { queryOnce, withTransaction } from '#db'
import { cachedLogQuery } from '../../utils/logs/cache.ts'

let analyticsQueue: Promise<unknown> = Promise.resolve()

export async function safeTrafficQuery(
    query: string,
    params: Array<string | number | boolean | string[] | Date | null> = [],
) {
    const aggregate = query.includes('traffic_aggregate_events')
    const load = async () => {
        try {
            const result = aggregate
                ? await withTransaction(async execute => {
                    await execute('SET LOCAL work_mem=\'64MB\'')
                    await execute('SET LOCAL statement_timeout=\'30s\'')
                    return execute(query, params)
                })
                : await queryOnce(query, params)
            return { ...result, sampled_at: new Date().toISOString() }
        } catch (error) {
            throw Object.assign(
                new Error('Traffic statistics are temporarily unavailable', { cause: error }),
                { statusCode: 503 },
            )
        }
    }

    if (!aggregate) return load()
    const key = 'traffic:' + query.replace(/\s+/g, ' ').trim() + JSON.stringify(params)
    return cachedLogQuery(key, 30000, () => {
        const pending = analyticsQueue.then(load, load)
        analyticsQueue = pending.catch(() => {})
        return pending
    })
}
