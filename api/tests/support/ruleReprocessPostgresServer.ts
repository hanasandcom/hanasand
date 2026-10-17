type Query = (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>
type LogFactory = (name: string, patch?: any, org?: string, indexed?: boolean) => Promise<any>

type ServerScenario = {
    query: Query
    add: LogFactory
    postRule: (...args: any[]) => any
    postRulePreview: (...args: any[]) => any
    getEvents: (...args: any[]) => any
    getRuleReprocess: (...args: any[]) => any
    postRuleReprocess: (...args: any[]) => any
    processRuleReprocessJob: () => Promise<boolean>
}

export async function runRuleReprocessPostgresServer({
    query, add, postRule, postRulePreview, getEvents,
    getRuleReprocess, postRuleReprocess, processRuleReprocessJob,
}: ServerScenario) {
    await query('DROP TRIGGER reject_test_delete ON service_logs')
    await add('ui-check')
    const Fastify = (await import('fastify')).default
    const app = Fastify()
    app.post('/api/backend/rules', postRule)
    app.post('/api/backend/rules/preview', postRulePreview)
    app.get('/api/backend/events', getEvents)
    app.get('/api/backend/rules/:id/reprocess', getRuleReprocess)
    app.post('/api/backend/rules/:id/reprocess', postRuleReprocess)
    await app.listen({ port: 55448, host: '127.0.0.1' })
    let processing = false
    const timer = setInterval(async () => {
        if (processing) return
        processing = true
        try { await processRuleReprocessJob() } finally { processing = false }
    }, 200)
    console.log('UI integration ready on 127.0.0.1:55448')
    await new Promise<void>(resolve => process.once('SIGTERM', resolve))
    clearInterval(timer)
    await app.close()
    assert.equal((await query('SELECT count(*) FROM events WHERE id=\'ui-check\'')).rows[0].count, '0')
    assert.equal((await query('SELECT count(*) FROM service_logs WHERE message=\'routine ui-check\'')).rows[0].count, '0')
    console.log('PASS: the browser-created rule and UI reprocess action deleted both real PostgreSQL copies.')
}
import assert from 'node:assert/strict'
