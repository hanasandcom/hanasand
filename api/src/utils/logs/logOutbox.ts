import run, { withTransaction } from '#db'
import type { LogRecordEntry } from './recordLogTypes.ts'
import { redactLogText, redactLogValue } from './redact.ts'
import { createHash, randomUUID } from 'node:crypto'

type Query = typeof run
type Organization = {
    id: string
    name: string
    status: string
    retention_days: number
    audit_safe_metadata: Record<string, unknown>
    updated_at: Date | string
}
type SnapshotRule = Record<string, unknown> & { updated_at: Date | string }

const endpoint = () => process.env.LOGS_SERVICE_URL?.replace(/\/$/, '')
const ingestToken = () => process.env.LOGS_SERVICE_INGEST_TOKEN
const syncToken = () => process.env.LOGS_SERVICE_SYNC_TOKEN

export function logsOutboxEnabled() {
    return process.env.LOGS_OUTBOX_ENABLED === '1'
}

export async function ensureLogsOutboxSchema(query: Query = run) {
    await query(`CREATE TABLE IF NOT EXISTS log_organization_sync_outbox (
        organization_id TEXT PRIMARY KEY,
        source_updated_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        lease_until TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        last_error TEXT
    )`)
    await query(`CREATE INDEX IF NOT EXISTS idx_log_organization_sync_pending
        ON log_organization_sync_outbox(available_at, organization_id) WHERE delivered_at IS NULL`)
    await query(`CREATE TABLE IF NOT EXISTS log_organization_sync_cursor (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        organization_id TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await query(`CREATE TABLE IF NOT EXISTS log_delivery_outbox (
        id BIGSERIAL PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        lease_until TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await query(`CREATE INDEX IF NOT EXISTS idx_log_delivery_pending
        ON log_delivery_outbox(available_at, id) WHERE delivered_at IS NULL`)
}

function requestedOrganizationId(entry: LogRecordEntry) {
    const metadata = entry.metadata || {}
    return typeof metadata.organizationId === 'string' && metadata.organizationId
        ? metadata.organizationId
        : typeof metadata.tenantId === 'string' && metadata.tenantId ? metadata.tenantId : null
}

async function enqueueOrganizationSnapshots(organizations: Organization[], query: Query) {
    if (!organizations.length) return
    const rules = await query(`SELECT id, organization_id, rule_id, version, name, family, severity,
        explanation, definition, source, source_reference, enabled, created_by, created_at, updated_at
        FROM rules WHERE organization_id = ANY($1::text[]) ORDER BY organization_id, rule_id`, [organizations.filter(item => item.status !== 'deleted').map(item => item.id)])
    const rulesByOrganization = new Map<string, SnapshotRule[]>()
    for (const rule of rules.rows as Array<Record<string, unknown> & { organization_id: string; updated_at: Date | string }>) {
        const { organization_id: organizationId, ...value } = rule
        rulesByOrganization.set(organizationId, [...(rulesByOrganization.get(organizationId) || []), {
            ...value, updated_at: rule.updated_at, sourceReference: String(value.source_reference || value.id),
        } as SnapshotRule])
    }

    const organizationPayloads = organizations.map(organization => {
        const storedRules = rulesByOrganization.get(organization.id) || []
        const organizationRules = organization.status === 'active' ? storedRules : storedRules.map(rule => ({ ...rule, enabled: false }))
        const newestRule = organizationRules.reduce<Date | string | null>((latest, rule) => {
            const current = rule.updated_at as Date | string
            return !latest || new Date(current).getTime() > new Date(latest).getTime() ? current : latest
        }, null)
        const sourceUpdatedAt = newestRule && new Date(newestRule).getTime() > new Date(organization.updated_at).getTime()
            ? newestRule : organization.updated_at
        const payload = {
            id: organization.id, name: organization.name, status: organization.status,
            retentionDays: organization.retention_days, auditSafeMetadata: organization.audit_safe_metadata,
            updatedAt: sourceUpdatedAt, rules: organizationRules,
        }
        return { id: organization.id, source_updated_at: sourceUpdatedAt, payload }
    })
    await query(`INSERT INTO log_organization_sync_outbox(organization_id, source_updated_at, payload)
            SELECT item.id, item.source_updated_at, item.payload FROM jsonb_to_recordset($1::jsonb) AS item(
                id text, source_updated_at timestamptz, payload jsonb)
            ON CONFLICT (organization_id) DO UPDATE SET
                source_updated_at=GREATEST(EXCLUDED.source_updated_at, log_organization_sync_outbox.source_updated_at + INTERVAL '1 microsecond'),
                payload=jsonb_set(EXCLUDED.payload, '{updatedAt}', to_jsonb(GREATEST(EXCLUDED.source_updated_at,
                    log_organization_sync_outbox.source_updated_at + INTERVAL '1 microsecond')), FALSE),
                attempts=0, available_at=NOW(), lease_until=NULL, delivered_at=NULL, last_error=NULL
            WHERE log_organization_sync_outbox.source_updated_at < EXCLUDED.source_updated_at
               OR (log_organization_sync_outbox.payload - 'updatedAt') IS DISTINCT FROM (EXCLUDED.payload - 'updatedAt')`, [JSON.stringify(organizationPayloads)])
}

export async function refreshLogsOrganizationSnapshotBatch(query: Query = run) {
    if (!logsOutboxEnabled() || !endpoint() || !ingestToken() || !syncToken()) return 0
    const result = await query(`WITH cursor AS (
            SELECT COALESCE((SELECT organization_id FROM log_organization_sync_cursor WHERE id=TRUE), '') last_id
        ), selected AS (
            SELECT id, name, status, retention_days, audit_safe_metadata, updated_at
            FROM organizations, cursor WHERE id > last_id ORDER BY id LIMIT 10
        ) SELECT * FROM selected`)
    let organizations = result.rows as Organization[]
    if (!organizations.length) {
        const first = await query(`SELECT id, name, status, retention_days, audit_safe_metadata, updated_at
            FROM organizations ORDER BY id LIMIT 10`)
        organizations = first.rows as Organization[]
    }
    if (!organizations.length) return 0
    await enqueueOrganizationSnapshots(organizations, query)
    await query(`INSERT INTO log_organization_sync_cursor(id, organization_id, updated_at)
        VALUES(TRUE,$1,NOW()) ON CONFLICT(id) DO UPDATE SET organization_id=EXCLUDED.organization_id, updated_at=NOW()`,
    [organizations[organizations.length - 1]!.id])
    return organizations.length
}

export async function enqueueLogsForIndependentService(entries: LogRecordEntry[], query: Query) {
    if (!logsOutboxEnabled() || !entries.length) return
    if (!endpoint() || !ingestToken() || !syncToken()) throw new Error('Logs outbox is enabled without its URL and service credentials.')

    const normalized = entries.map(entry => ({
        ...entry,
        service: entry.service || process.env.SERVICE_NAME || 'hanasand-api',
        host: entry.host || process.env.HOSTNAME || 'local',
        sourceEventId: createHash('sha256').update(`service:${entry.sourceEventId || randomUUID()}`).digest('hex'),
    }))
    const requestedIds = [...new Set(normalized.map(requestedOrganizationId).filter((id): id is string => Boolean(id)))]
    const platformId = process.env.PLATFORM_LOG_ORGANIZATION_ID || null
    const organizations = await query(`SELECT id, name, status, retention_days, audit_safe_metadata, updated_at
        FROM organizations
        WHERE id = ANY($1::text[])
           OR (status = 'active' AND (id = $2 OR ($2::text IS NULL AND lower(name) = 'hanasand')))
        ORDER BY id`, [requestedIds, platformId])
    const byId = new Map((organizations.rows as Organization[]).map(item => [item.id, item]))
    const platform = organizations.rows.find((item: Organization) => item.status === 'active'
        && (item.id === platformId || (platformId === null && item.name.toLowerCase() === 'hanasand'))) as Organization | undefined
    if (!platform) throw new Error('Logs outbox cannot resolve the active platform organization.')

    const targetIds = new Set<string>()
    const prepared = normalized.map(entry => {
        const requestedId = requestedOrganizationId(entry)
        const requested = requestedId ? byId.get(requestedId) : undefined
        const deleted = Boolean(requested && (requested.status === 'deleted' || Object.hasOwn(requested.audit_safe_metadata || {}, 'privacyDeletedAt')))
        const unresolvedScope = Boolean(requestedId && (!requested || requested.status !== 'active'))
        const target = requested?.status === 'active' && !deleted ? requested : platform
        const organizationId = target.id
        targetIds.add(organizationId)

        if (deleted || unresolvedScope) {
            const metadata = {
                category: deleted ? 'organization_privacy' : 'organization_scope',
                action: deleted ? 'post_delete_event' : 'unresolved_scope_event',
                organizationId, tenantId: organizationId, outcome: 'recorded',
                ...(deleted ? {} : { requestedOrganizationId: requestedId, requestedOrganizationStatus: requested?.status || 'missing' }),
                privacyDeletionRunId: requested?.audit_safe_metadata?.privacyDeletionRunId,
            }
            return {
                event: {
                    service: 'hanasand-api', host: '', level: deleted ? 'info' : 'error', message: 'organization_event',
                    metadata: redactLogValue(metadata), sourceEventId: entry.sourceEventId!,
                    timestamp: entry.timestamp || new Date().toISOString(),
                },
                organizationId,
            }
        }

        const metadata = redactLogValue({ ...(entry.metadata || {}), organizationId, tenantId: organizationId })
        return {
            event: {
                service: entry.service!, host: entry.host!, level: entry.level || 'info',
                message: redactLogText(entry.message), metadata,
                sourceEventId: entry.sourceEventId!, timestamp: entry.timestamp || new Date().toISOString(),
            },
            organizationId,
        }
    })
    const snapshotIds = new Set([...targetIds, ...requestedIds])
    await enqueueOrganizationSnapshots((organizations.rows as Organization[]).filter(item => snapshotIds.has(item.id)), query)

    if (prepared.length) await query(`INSERT INTO log_delivery_outbox(event_id, organization_id, payload)
        SELECT item.event_id, item.organization_id, item.payload FROM jsonb_to_recordset($1::jsonb) AS item(
            event_id text, organization_id text, payload jsonb) ON CONFLICT(event_id) DO NOTHING`,
    [JSON.stringify(prepared.map(item => ({ event_id: item.event.sourceEventId, organization_id: item.organizationId, payload: item.event })))])
}

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
    const base = endpoint()
    const ingest = ingestToken()
    const sync = syncToken()
    if (!logsOutboxEnabled() || !base || !ingest || !sync) return false

    const organizations = await claimOrganizations()
    if (organizations.length) {
        let response: Response
        try {
            response = await sendRows(`${base}/api/organizations/sync`, sync, { organizations: organizations.map(row => row.payload) })
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
        response = await sendRows(`${base}/api/ingest`, ingest, { events: events.map(row => row.payload) })
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
    if (!endpoint() || !ingestToken() || !syncToken()) {
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
