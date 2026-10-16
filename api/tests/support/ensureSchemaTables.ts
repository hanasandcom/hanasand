import { readdirSync, readFileSync } from 'node:fs'

type SchemaQuery = (sql: string) => Promise<unknown>

export function extractEnsureSchemaTable(schema: string, tableName: string) {
    const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const definition = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${escapedName} \\([\\s\\S]*?\\n        \\)`))?.[0]
    if (!definition) throw new Error(`Missing schema for ${tableName}`)
    return definition
}

export async function installEnsureSchemaTables(
    callerUrl: string,
    query: SchemaQuery,
    tables: readonly string[],
    { temporary = false }: { temporary?: boolean } = {},
) {
    const schemaDirectory = new URL('../src/utils/db/', callerUrl)
    const schema = readdirSync(schemaDirectory)
        .filter(name => name.endsWith('.ts'))
        .sort()
        .map(name => readFileSync(new URL(name, schemaDirectory), 'utf8'))
        .join('\n')
    for (const table of tables) {
        const definition = extractEnsureSchemaTable(schema, table)
        await query(temporary
            ? definition.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE')
            : definition)
    }
}
