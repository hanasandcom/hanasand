import { expect, test } from 'bun:test'
import { extractEnsureSchemaTable, installEnsureSchemaTables } from './support/ensureSchemaTables.ts'
import { createServiceLogsFixture } from './support/serviceLogsFixture.ts'

test('extracts a named ensureSchema table definition and rejects missing names', () => {
    const schema = `CREATE TABLE IF NOT EXISTS events (
        id text PRIMARY KEY
        )
CREATE TABLE IF NOT EXISTS rules (
        id text PRIMARY KEY
        )`

    expect(extractEnsureSchemaTable(schema, 'events')).toBe(`CREATE TABLE IF NOT EXISTS events (
        id text PRIMARY KEY
        )`)
    expect(() => extractEnsureSchemaTable(schema, 'missing')).toThrow('Missing schema for missing')
})

test('installs selected ensureSchema tables in order and can use temporary tables', async () => {
    const statements: string[] = []
    await installEnsureSchemaTables(
        import.meta.url,
        async (sql) => { statements.push(sql) },
        ['organizations', 'events'],
        { temporary: true },
    )

    expect(statements).toHaveLength(2)
    expect(statements[0]).toContain('CREATE TEMP TABLE organizations')
    expect(statements[1]).toContain('CREATE TEMP TABLE events')
})

test('creates regular and temporary service log fixture tables with the same columns', async () => {
    const statements: string[] = []
    const query = async (sql: string) => { statements.push(sql) }

    await createServiceLogsFixture(query)
    await createServiceLogsFixture(query, true)

    expect(statements[0]).toMatch(/^CREATE TABLE service_logs \(/)
    expect(statements[1]).toMatch(/^CREATE TEMP TABLE service_logs \(/)
    expect(statements[0].replace('CREATE TABLE', 'CREATE TEMP TABLE')).toBe(statements[1])
})
