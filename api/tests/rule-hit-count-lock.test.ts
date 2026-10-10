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

test('receipt and finding counter deltas append per statement without a global receipt lock', async () => {
    await ensureRuleHitCountSchema()

    expect(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS rule_hit_count_deltas'))).toBe(true)
    expect(statements.some(sql => sql.includes('CREATE OR REPLACE FUNCTION record_rule_hit_count_delta()'))).toBe(true)
    expect(statements.filter(sql => sql.includes('FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()'))).toHaveLength(6)
    expect(statements.some(sql => sql.includes('DROP TRIGGER IF EXISTS log_analyze_receipts_write_lock ON log_analyze_receipts'))).toBe(true)
    expect(statements.some(sql => sql.includes('pg_advisory_xact_lock(hashtextextended(\'hanasand:log_analyze_receipts\', 0))'))).toBe(false)
})
