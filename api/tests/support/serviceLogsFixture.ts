type FixtureQuery = (sql: string) => Promise<unknown>

export async function createServiceLogsFixture(query: FixtureQuery, temporary = false) {
    const tableType = temporary ? 'TEMP ' : ''
    await query(`CREATE ${tableType}TABLE service_logs (
        id BIGSERIAL PRIMARY KEY,
        service TEXT NOT NULL DEFAULT '',
        host TEXT NOT NULL DEFAULT '',
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL DEFAULT '',
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}
