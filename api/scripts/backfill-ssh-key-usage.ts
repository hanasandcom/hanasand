import run, { closeDatabase, identityQueryOnce } from '../src/utils/db.ts'
import { normalizeHostPublicKey } from '../src/utils/hostSsh.ts'
import { recordProfileSshKeyUsageFromEvents } from '../src/utils/sshKeyUsage.ts'

async function backfill() {
    const keys = await identityQueryOnce(`
        SELECT DISTINCT c.public_key
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        JOIN users u ON u.id = uc.user_id
        WHERE u.active IS TRUE AND u.deletion_scheduled_at IS NULL
    `)
    const fingerprints = [...new Set(keys.rows.flatMap(row => {
        const normalized = normalizeHostPublicKey(row.public_key)
        return normalized ? [normalized.fingerprint] : []
    }))]
    if (!fingerprints.length) {
        process.stdout.write('No assigned SSH keys to backfill.\n')
        return
    }

    const organization = await run(`
        SELECT id FROM organizations
        WHERE status = 'active'
          AND (id = $1 OR ($1::text IS NULL AND lower(name) = 'hanasand'))
        ORDER BY created_at
        LIMIT 1
    `, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
    const organizationId = organization.rows[0]?.id
    if (!organizationId) throw new Error('No active Hanasand log organization was found.')

    const evidence = await run(`
        SELECT DISTINCT ON (
            substring(e.normalized->>'message' FROM '(SHA256:[A-Za-z0-9+/]{43})'),
            e.normalized->>'host', e.normalized->'user'->>'name'
        ) e.event_timestamp, e.normalized
        FROM events e
        WHERE e.organization_id = $1
          AND e.event_timestamp >= statement_timestamp() - INTERVAL '90 days'
          AND e.ingestion_id = 'logs'
          AND e.event_type = 'authentication'
          AND e.action = 'login'
          AND e.outcome = 'success'
          AND e.normalized->>'service' = 'sshd'
          AND e.normalized->>'host' IN ('inspur', 'hanasand', 'ovh', 'ovhcloud')
          AND e.normalized->>'message' LIKE 'Accepted publickey for % ssh2: % SHA256:%'
          AND substring(e.normalized->>'message' FROM '(SHA256:[A-Za-z0-9+/]{43})') = ANY($2::text[])
        ORDER BY substring(e.normalized->>'message' FROM '(SHA256:[A-Za-z0-9+/]{43})'),
            e.normalized->>'host', e.normalized->'user'->>'name', e.event_timestamp DESC
    `, [organizationId, fingerprints])

    const count = await recordProfileSshKeyUsageFromEvents(evidence.rows.map(row => ({
        ...row.normalized,
        timestamp: row.normalized?.timestamp || row.event_timestamp,
    })))
    process.stdout.write(`Backfilled ${count} latest SSH key/server usage records from the last 90 days of evidence.\n`)
}

try {
    await backfill()
} finally {
    await closeDatabase()
}
