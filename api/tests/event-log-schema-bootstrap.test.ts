import { expect, mock, test } from 'bun:test'

const statements: string[] = []
let cursorTableExists = false

mock.module('#db', () => ({
    default: async (sql: string) => {
        statements.push(sql)
        if (sql.includes('CREATE TABLE IF NOT EXISTS log_processing_cursors')) cursorTableExists = true
        if (sql.startsWith('DELETE FROM log_processing_cursors') && !cursorTableExists) {
            throw new Error('log_processing_cursors does not exist')
        }
        return { rows: [] }
    },
}))
mock.module('../src/utils/db/existingSchema.ts', () => ({
    ensureColumn: async () => {},
    ensureIndex: async () => {},
}))
mock.module('../src/utils/db/logCatchupSchema.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/db/logDimensionsSchema.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/db/logTuningSchema.ts', () => ({ default: async () => {} }))

const { default: ensureEventLogSchema } = await import('../src/utils/db/eventLogSchema.ts')

test('fresh schema creates log cursors before deleting legacy cursor rows', async () => {
    await expect(ensureEventLogSchema()).resolves.toBeUndefined()

    const createCursorTable = statements.findIndex(statement => statement.includes('CREATE TABLE IF NOT EXISTS log_processing_cursors'))
    const deleteLegacyRows = statements.findIndex(statement => statement.startsWith('DELETE FROM log_processing_cursors'))
    expect(createCursorTable).toBeGreaterThanOrEqual(0)
    expect(deleteLegacyRows).toBeGreaterThan(createCursorTable)
})
