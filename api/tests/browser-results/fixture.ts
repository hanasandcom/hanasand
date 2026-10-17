import { beforeEach, expect, mock } from 'bun:test'
import { browserResultId } from '../../src/utils/ws/browserResultIdentity.ts'

export const state: {
    userId: string
    inserted: unknown[]
    historyQuery: { sql: string; params: any[] } | null
    latestRunsQuery: { sql: string; params: any[] } | null
    deleteQuery: { sql: string; params: any[] } | null
} = {
    userId: 'owner',
    inserted: [],
    historyQuery: null,
    latestRunsQuery: null,
    deleteQuery: null,
}

const records = [
    { id: 'new', target: 'https://vg.no', owner_id: 'owner', created_at: '2026-09-23T12:00:00Z', status: 'ended' },
    { id: 'old', target: 'https://vg.no', owner_id: 'owner', created_at: '2026-01-01T12:00:00Z', status: 'ended' },
]

mock.module('#db', () => ({ default: async (sql: string, params: any[]) => {
    if (sql.includes('quota_identity = $1')) return { rows: [{ used: 0, active: 0 }] }
    if (sql.includes('billing_entitlements')) return { rows: [{ paid: false, legacy_plan: null }] }
    if (sql.includes('FROM browser_runs') && sql.includes('DISTINCT ON (result_id)')) {
        state.latestRunsQuery = { sql, params }
        return { rows: [] }
    }
    if (sql.includes('WITH selected_results') || sql.includes('jsonb_build_object(\'historyDeletedAt\'')) {
        state.deleteQuery = { sql, params }
        return { rows: [{ id: 'one' }, { id: 'two' }] }
    }
    if (sql.includes('LIMIT 51 OFFSET')) {
        state.historyQuery = { sql, params }
        return { rows: Array.from({ length: params.at(-1) === 0 ? 51 : 2 }, (_, index) => ({ ...records[0], id: String(index + params.at(-1)) })) }
    }
    if (sql.includes('INSERT INTO browser_run_evidence')) { state.inserted = params; return { rows: [] } }
    if (sql.includes('WHERE result_id')) {
        expectOwnershipSql(sql)
        return { rows: records.filter(row => row.owner_id === params[1] && browserResultId(row.target) === params[0]) }
    }
    if (sql.includes('SELECT metadata')) return { rows: [{ metadata: { report: { analystSummary: { narrative: 'Saved analysis' } } } }] }
    if (sql.includes('SELECT payload')) return { rows: [{ payload: { type: 'frame', image: 'saved-image', url: 'https://vg.no/', evidence: { textExcerpt: 'Full captured text', sourceCode: '<main>Full source</main>' } } }] }
    throw new Error(sql)
}, withTransaction: async () => {} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: Boolean(state.userId), id: state.userId }) }))
const { deleteBrowserRuns, getBrowserRuns, getBrowserResult, buildStoredBrowserReport, persistBrowserRunEvidence } = await import('../../src/handlers/browserSandboxRuns.ts')

export const handlers = { deleteBrowserRuns, getBrowserRuns, getBrowserResult, buildStoredBrowserReport, persistBrowserRunEvidence }
export { records }

export const response = () => ({ code: 200, body: null as any, status(code: number) { this.code = code; return this }, header() { return this }, send(body: any) { this.body = body; return this } })

beforeEach(() => {
    state.userId = 'owner'
    state.inserted = []
    state.historyQuery = null
    state.latestRunsQuery = null
    state.deleteQuery = null
})

function expectOwnershipSql(sql: string) {
    expect(sql).toContain('owner_id = $2 OR client_id_hash = $3')
}
