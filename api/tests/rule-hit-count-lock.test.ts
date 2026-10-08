import { expect, mock, test } from 'bun:test'

const statements: string[] = []
const query = async (sql: string) => {
    statements.push(sql)
    if (sql.includes('SELECT initialized FROM rule_hit_count_state')) return { rows: [{ initialized: true }] }
    return { rows: [] }
}
mock.module('#db', () => ({
    default: query,
    withTransaction: async (work: typeof query) => work(query),
}))

const { default: ensureRuleHitCountSchema } = await import('../src/utils/db/ruleHitCountSchema.ts')

test('receipt counter writes serialize before row triggers acquire shared count rows', async () => {
    await ensureRuleHitCountSchema()

    expect(statements.some(sql => sql.includes("pg_advisory_xact_lock(hashtextextended('hanasand:log_analyze_receipts', 0))"))).toBe(true)
    expect(statements.some(sql => sql.includes('BEFORE INSERT OR UPDATE OR DELETE ON log_analyze_receipts')
        && sql.includes('FOR EACH STATEMENT EXECUTE FUNCTION serialize_log_analyze_receipt_writes()'))).toBe(true)
})
