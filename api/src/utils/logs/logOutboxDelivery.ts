import run, { withTransaction } from '#db'
import { logsOutboxEnabled, logsServiceConfiguration } from './logOutboxConfig.ts'
import { refreshLogsOrganizationSnapshotBatch } from './logOutboxSnapshots.ts'

type OutboxLog = { id: number; payload: Record<string, unknown>; attempts: number }
type OutboxOrganization = { organization_id: string; source_updated_at: Date | string; payload: Record<string, unknown>; attempts: number }

async function claimOrganizations(): Promise<OutboxOrganization[]> {
    return withTransaction(async query => (await query(`WITH selected AS (
            SELECT organization_id FROM log_organization_sync_outbox
            WHERE delivered_at IS NULL AND available_at <= NOW() AND (lease_until IS NULL OR lease_until < NOW())
            ORDER BY available_at, organization_id LIMIT 1 FOR UPDATE SKIP LOCKED
        ) UPDATE log_organization_sync_outbox o SET lease_until=NOW()+INTERVAL '60 seconds', attempts=o.attempts+1
        FROM selected WHERE o.organization_id=selected.organization_id
        RETURNING o.organization_id, o.source_updated_at, o.payload, o.attempts`)).rows as OutboxOrganization[])
}

async function claimEvents(): Promise<OutboxLog[]> {
    return withTransaction(async query => (await query(`WITH selected AS (
            SELECT e.id FROM log_delivery_outbox e
            JOIN log_organization_sync_outbox o ON o.organization_id=e.organization_id AND o.delivered_at IS NOT NULL
            WHERE e.delivered_at IS NULL AND e.available_at <= NOW() AND (e.lease_until IS NULL OR e.lease_until < NOW())
            ORDER BY e.available_at, e.id LIMIT 100 FOR UPDATE OF e SKIP LOCKED
        ) UPDATE log_delivery_outbox e SET lease_until=NOW()+INTERVAL '60 seconds', attempts=e.attempts+1
        FROM selected WHERE e.id=selected.id RETURNING e.id, e.payload, e.attempts`)).rows as OutboxLog[])
}

async function deferRows(table: 'log_organization_sync_outbox' | 'log_delivery_outbox', ids: Array<string | number>, attempts: number[], status: number, error: string) {
    if (!ids.length) return
    const delay = Math.min(3600, 2 ** Math.min(12, Math.max(...attempts)))
    const column = table === 'log_delivery_outbox' ? 'id' : 'organization_id'
    const type = table === 'log_delivery_outbox' ? 'bigint' : 'text'
    await run(`UPDATE ${table} SET lease_until=NULL, available_at=NOW()+($2::text || ' seconds')::interval,
        last_error=$3 WHERE ${column} = ANY($1::${type}[])`,
    [ids.map(String), delay, `HTTP ${status}: ${error.slice(0, 200)}`])
}

async function sendRows(url: string, token: string, body: unknown) {
    return fetch(url, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    })
}

export async function deliverLogsOutboxBatch() {
    const config = logsServiceConfiguration()
    if (!logsOutboxEnabled() || !config.url || !config.ingestToken || !config.syncToken) return false

    const organizations = await claimOrganizations()
    if (organizations.length) {
        let response: Response
        try {
            response = await sendRows(`${config.url}/api/organizations/sync`, config.syncToken, { organizations: organizations.map(row => row.payload) })
        } catch {
            await deferRows('log_organization_sync_outbox', organizations.map(row => row.organization_id), organizations.map(row => row.attempts), 0, 'organization service unavailable')
            throw new Error('Logs organization sync is unavailable; the durable outbox will retry.')
        }
        const result = await response.json().catch(() => ({})) as { ok?: boolean; accepted?: number }
        if (!response.ok || result.ok !== true || result.accepted !== organizations.length) {
            await deferRows('log_organization_sync_outbox', organizations.map(row => row.organization_id), organizations.map(row => row.attempts), response.status, 'organization synchronization was not acknowledged')
            throw new Error(`Logs organization sync was not acknowledged (HTTP ${response.status}).`)
        }
        await run(`UPDATE log_organization_sync_outbox o SET delivered_at=NOW(), lease_until=NULL, last_error=NULL
            FROM jsonb_to_recordset($1::jsonb) AS item(organization_id text, source_updated_at timestamptz)
            WHERE o.organization_id=item.organization_id AND o.source_updated_at=item.source_updated_at`,
        [JSON.stringify(organizations.map(row => ({ organization_id: row.organization_id, source_updated_at: row.source_updated_at })))])
    }

    const events = await claimEvents()
    if (!events.length) return organizations.length > 0
    let response: Response
    try {
        response = await sendRows(`${config.url}/api/ingest`, config.ingestToken, { events: events.map(row => row.payload) })
    } catch {
        await deferRows('log_delivery_outbox', events.map(row => row.id), events.map(row => row.attempts), 0, 'Logs API unavailable')
        throw new Error('Logs API is unavailable; the durable outbox will retry.')
    }
    const result = await response.json().catch(() => ({})) as { ok?: boolean; accepted?: number }
    if (!response.ok || result.ok !== true || result.accepted !== events.length) {
        await deferRows('log_delivery_outbox', events.map(row => row.id), events.map(row => row.attempts), response.status, 'event batch was not acknowledged')
        throw new Error(`Logs event batch was not acknowledged (HTTP ${response.status}).`)
    }
    // The receiver acknowledges only after its own transaction commits. Delete the
    // transfer copy after that acknowledgement so the source database does not
    // become a second long-term log store. A lost response safely replays by ID.
    await run('DELETE FROM log_delivery_outbox WHERE id=ANY($1::bigint[])', [events.map(row => String(row.id))])
    return true
}

export function startLogsOutboxDelivery(onError: (error: unknown) => void) {
    if (!logsOutboxEnabled()) return () => {}
    const config = logsServiceConfiguration()
    if (!config.url || !config.ingestToken || !config.syncToken) {
        onError(new Error('Logs outbox is enabled without LOGS_SERVICE_URL, LOGS_SERVICE_INGEST_TOKEN, and LOGS_SERVICE_SYNC_TOKEN.'))
    }
    let running = false
    let snapshotRunning = false
    const deliver = async () => {
        if (running) return
        running = true
        try { await deliverLogsOutboxBatch() } catch (error) { onError(error) } finally { running = false }
    }
    void deliver()
    const timer = setInterval(() => { void deliver() }, 1000)
    timer.unref()
    const refresh = async () => {
        if (snapshotRunning) return
        snapshotRunning = true
        try { await refreshLogsOrganizationSnapshotBatch() } catch (error) { onError(error) } finally { snapshotRunning = false }
    }
    void refresh()
    const snapshotTimer = setInterval(() => { void refresh() }, 60_000)
    snapshotTimer.unref()
    return () => { clearInterval(timer); clearInterval(snapshotTimer) }
}
