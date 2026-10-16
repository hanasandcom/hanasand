import { expect, test } from 'bun:test'
import pg from 'pg'
import { ensureColumn, ensureColumnNullable, ensureConstraint, ensureIndex, ensureRuleSourceConstraint } from '../src/utils/db/existingSchema.ts'
import { ensureOrganizationApiKeyOwnerSchema, ensureOrganizationCreatorReferenceSchema } from '../src/utils/db/organizationApiKeySchema.ts'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('existing-schema migrations avoid write conflicts and preserve organization keys after creator deletion', async () => {
    const namespace = `existing_schema_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.POSTGRES_FILTER_TEST_PORT), user: 'postgres', database: 'postgres_filter_test', options: `-c search_path=${namespace} -c lock_timeout=100ms` })
    const query: any = (sql: string, values?: unknown[]) => pool.query(sql, values)
    let writer: pg.PoolClient | undefined
    try {
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE service_logs(id bigint, source_event_id text)')
        await query('CREATE TABLE rules(source text, CONSTRAINT rules_source_check CHECK(source IN (\'owned\',\'open_source\')))')
        const column = 'ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS additional text'
        const index = 'CREATE INDEX IF NOT EXISTS log_source_test ON service_logs(source_event_id)'
        await ensureColumn(query, 'service_logs', 'additional', column)
        await ensureIndex(query, 'log_source_test', index)
        await ensureRuleSourceConstraint(query)

        await query('ALTER TABLE service_logs ADD COLUMN already_nullable TEXT, ADD COLUMN required_value TEXT NOT NULL DEFAULT \'present\'')
        const schemaMigrations: string[] = []
        const observedQuery: any = async (sql: string, values?: unknown[]) => {
            if (sql.startsWith('ALTER TABLE')) schemaMigrations.push(sql)
            return query(sql, values)
        }
        const nullableColumnMigration = 'ALTER TABLE service_logs ALTER COLUMN already_nullable DROP NOT NULL'
        const requiredColumnMigration = 'ALTER TABLE service_logs ALTER COLUMN required_value DROP NOT NULL'
        await ensureColumnNullable(observedQuery, 'service_logs', 'already_nullable', nullableColumnMigration)
        await ensureColumnNullable(observedQuery, 'service_logs', 'required_value', requiredColumnMigration)
        await ensureColumnNullable(observedQuery, 'service_logs', 'required_value', requiredColumnMigration)
        expect(schemaMigrations).toEqual([requiredColumnMigration])
        expect((await query('SELECT attname, attnotnull FROM pg_attribute WHERE attrelid=to_regclass(\'service_logs\') AND attname IN (\'already_nullable\', \'required_value\') ORDER BY attname')).rows)
            .toEqual([{ attname: 'already_nullable', attnotnull: false }, { attname: 'required_value', attnotnull: false }])

        const sourceConstraintMigration = 'ALTER TABLE rules ADD CONSTRAINT rules_source_not_null_test CHECK (source IS NOT NULL)'
        const sourceConstraintDefinition = 'CHECK ((source IS NOT NULL))'
        await ensureConstraint(observedQuery, 'rules', 'rules_source_not_null_test', sourceConstraintDefinition, sourceConstraintMigration)
        expect(schemaMigrations).toEqual([requiredColumnMigration, sourceConstraintMigration])
        await ensureConstraint(observedQuery, 'rules', 'rules_source_not_null_test', sourceConstraintDefinition, sourceConstraintMigration)
        expect(schemaMigrations).toEqual([requiredColumnMigration, sourceConstraintMigration])
        expect((await query('SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=to_regclass(\'rules\') AND conname=\'rules_source_not_null_test\'')).rows[0].definition)
            .toBe(sourceConstraintDefinition)

        await query('INSERT INTO rules VALUES(\'hanasand\')')
        expect((await query('SELECT additional FROM service_logs')).rowCount).toBe(0)
        await query('INSERT INTO service_logs(id) VALUES(0),(0)')
        await expect(query('CREATE UNIQUE INDEX CONCURRENTLY log_bad_test ON service_logs(id)')).rejects.toMatchObject({ code: '23505' })
        await expect(ensureIndex(query, 'log_bad_test', 'CREATE INDEX IF NOT EXISTS log_bad_test ON service_logs(id)')).rejects.toThrow('not ready')
        writer = await pool.connect()
        await writer.query('BEGIN')
        await writer.query('INSERT INTO service_logs(id) VALUES(1); INSERT INTO rules VALUES(\'owned\')')
        await ensureColumn(query, 'service_logs', 'additional', column)
        await ensureIndex(query, 'log_source_test', index)
        await ensureRuleSourceConstraint(query)
        await ensureColumnNullable(observedQuery, 'service_logs', 'already_nullable', nullableColumnMigration)
        await ensureConstraint(observedQuery, 'rules', 'rules_source_not_null_test', sourceConstraintDefinition, sourceConstraintMigration)
        expect(schemaMigrations).toEqual([requiredColumnMigration, sourceConstraintMigration])
        expect((await query('SELECT count(*)::int AS count FROM rules')).rows[0].count).toBe(1)

        await query('CREATE TABLE users (id text PRIMARY KEY)')
        await query(`CREATE TABLE organizations (
            id text PRIMARY KEY,
            created_by text NOT NULL CONSTRAINT organizations_created_by_fkey REFERENCES users(id) ON DELETE CASCADE
        )`)
        await query(`CREATE TABLE api_keys (
            id text PRIMARY KEY,
            owner_id text NOT NULL CONSTRAINT api_keys_owner_id_fkey REFERENCES users(id) ON DELETE CASCADE,
            organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name text NOT NULL,
            enabled boolean NOT NULL DEFAULT true
        )`)
        await query('CREATE UNIQUE INDEX idx_api_keys_one_active_org ON api_keys(organization_id) WHERE enabled')
        await query('INSERT INTO users (id) VALUES (\'creator\')')
        await query('INSERT INTO organizations (id, created_by) VALUES (\'org-1\', \'creator\')')
        await query('INSERT INTO api_keys (id, owner_id, organization_id, name) VALUES (\'key-1\', \'creator\', \'org-1\', \'Production\')')

        await ensureOrganizationCreatorReferenceSchema(query)
        await ensureOrganizationApiKeyOwnerSchema(query)

        expect((await query('SELECT to_regclass(\'idx_api_keys_one_active_org\') IS NULL AS legacy_index_removed')).rows[0].legacy_index_removed).toBe(true)
        await query('INSERT INTO api_keys (id, owner_id, organization_id, name) VALUES (\'key-2\', \'creator\', \'org-1\', \'Development\')')
        await ensureOrganizationCreatorReferenceSchema(query)
        await ensureOrganizationApiKeyOwnerSchema(query)
        await query('DELETE FROM users WHERE id = \'creator\'')

        expect((await query('SELECT id, created_by FROM organizations')).rows).toEqual([{ id: 'org-1', created_by: null }])
        expect((await query('SELECT id, owner_id, organization_id, name FROM api_keys ORDER BY id')).rows).toEqual([
            { id: 'key-1', owner_id: null, organization_id: 'org-1', name: 'Production' },
            { id: 'key-2', owner_id: null, organization_id: 'org-1', name: 'Development' },
        ])

        await expect(ensureColumn(query, 'service_logs', 'missing', 'ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS missing text')).rejects.toMatchObject({ code: '55P03' })
    } finally {
        if (writer) { await writer.query('ROLLBACK'); writer.release() }
        await query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`)
        await pool.end()
    }
})
