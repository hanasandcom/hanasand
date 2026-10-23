import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function extractTableDdl(source: string, table: string) {
    const statements = source.match(/CREATE TABLE IF NOT EXISTS [a-z_]+ \([\s\S]*?\n\s*\)\n/g) || []
    const ddl = statements.find(statement => statement.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))
    if (!ddl) throw Error(`Missing exact canonical fixture DDL: ${table}`)
    return ddl
}

async function main() {
    const prefix = process.env.WATCHLIST_STAGE_PREFIX || ''
    const hostname = process.env.DB_HOST
    if (!/^ti-native-proof-[a-f0-9]{12}$/.test(prefix) || hostname !== `${prefix}-db`
        || process.env.WATCHLIST_PROOF_STAGE !== 'synthetic-only' || process.env.DB !== 'core_watchlist_proof_test'
        || process.env.DB_USER !== 'synthetic' || process.env.DB_PASSWORD !== 'synthetic-local-only'
        || process.env.HANASAND_IDENTITY_FDW_HOST !== hostname || process.env.IDENTITY_DB_NAME !== 'ti_native_proof_test') throw Error('Requires fresh synthetic three-database stage')
    const options = { host: hostname, user: 'synthetic', password: 'synthetic-local-only', port: 5432 }
    const clients: pg.Client[] = []
    async function connect(database: string) {
        const client = new pg.Client({ ...options, database })
        clients.push(client); await client.connect(); return client
    }
    try {
        const admin = await connect('ti_native_proof_test')
        for (const database of ['core_watchlist_proof_test', 'ti_watchlist_projection_test']) await admin.query(`CREATE DATABASE ${database}`)
        const core = await connect('core_watchlist_proof_test')
        const projection = await connect('ti_watchlist_projection_test')
        await core.query('CREATE EXTENSION postgres_fdw; CREATE SCHEMA identity_data_remote')
        await core.query(`CREATE SERVER identity_data_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host '${hostname}', port '5432', dbname 'ti_native_proof_test')`)
        await core.query('CREATE USER MAPPING FOR synthetic SERVER identity_data_server OPTIONS (user \'synthetic\', password \'synthetic-local-only\')')
        const tables = ['users', 'organizations', 'organization_members', 'organization_invites', 'organization_watchlist_items', 'roles', 'user_roles', 'api_keys', 'api_key_scopes', 'system_events', 'system_event_acknowledgments']
        // Match production import semantics exactly; do not add foreign defaults to mask write failures.
        await core.query(`IMPORT FOREIGN SCHEMA public LIMIT TO (${tables.join(',')}) FROM SERVER identity_data_server INTO identity_data_remote`)
        for (const table of tables) await core.query(`CREATE VIEW public.${table} AS SELECT * FROM identity_data_remote.${table}`)
        await core.query('CREATE TABLE identity_data_boundary(version text PRIMARY KEY, row_counts jsonb NOT NULL, migrated_at timestamptz DEFAULT NOW()); INSERT INTO identity_data_boundary VALUES (\'synthetic-only\',\'{}\',NOW())')
        const { default: run, closeDatabase } = await import('../../src/utils/db.ts')
        try {
            for (const [file, table] of [['apiAccessSchema.ts', 'api_rate_limit_settings'], ['apiAccessSchema.ts', 'api_rate_limit_buckets'], ['billingSchema.ts', 'billing_entitlements'], ['billingSchema.ts', 'billing_usage']]) {
                const source = readFileSync(`/app/src/utils/db/${file}`, 'utf8')
                const ddl = extractTableDdl(source, table)
                // Actual query normalizer strips foreign-view REFERENCES just as production does.
                await run(ddl)
            }
        } finally { await closeDatabase() }
        await core.query('INSERT INTO billing_entitlements(user_id,plan_id,quotas) VALUES (\'synthetic-customer\',\'synthetic-watchlists\',\'{"watchTerms":50}\')')
        const organizationId = '.synthetic:core@organization'
        await admin.query('INSERT INTO organizations(id,name,slug,status) VALUES($1,\'Synthetic Core Watchlists\',\'synthetic-core-watchlists\',\'active\')', [organizationId])
        await admin.query('INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,\'synthetic-customer\',\'owner\',\'active\')', [organizationId])
        const migration = readFileSync('/scraper/migrations/006_threat_intelligence_store.sql', 'utf8')
        const workflowDdl = migration.match(/CREATE TABLE IF NOT EXISTS threat_intel\.workflow_records \([\s\S]*?\n\);/)?.[0]
        if (!workflowDdl) throw Error('Missing canonical workflow_records DDL')
        await projection.query('CREATE SCHEMA threat_intel'); await projection.query(workflowDdl)
        const shape = await core.query('SELECT c.relname,c.relkind FROM pg_class c WHERE c.oid IN (\'public.users\'::regclass,\'public.organization_watchlist_items\'::regclass)')
        if (shape.rows.length !== 2 || shape.rows.some(row => row.relkind !== 'v')) throw Error('Core source boundary is not FDW views')
        console.log('Synthetic FDW source views and separate direct-Identity audit database configured; no legacy cutover executed.')
    } finally { await Promise.all(clients.map(client => client.end())) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
