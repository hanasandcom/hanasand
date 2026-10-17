import { afterEach, beforeEach, mock } from 'bun:test'
import Fastify from 'fastify'

type QueryCall = { sql: string; params: unknown[] }

export const calls: QueryCall[] = []
export const transactionCalls: QueryCall[] = []
export const state: {
    rows: Array<Record<string, unknown>>
    failure: Error | undefined
    transactionCount: number
    transactionFailureOnCall: number | undefined
} = { rows: [], failure: undefined, transactionCount: 0, transactionFailureOnCall: undefined }

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params })
        if (state.failure) throw state.failure
        if (/^\s*SELECT/.test(sql)) return { rows: state.rows }
        return { rows: [] }
    },
    withTransaction: async (work: (query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) => Promise<unknown>) => {
        state.transactionCount++
        return work(async (sql, params = []) => {
            transactionCalls.push({ sql, params })
            if (state.transactionFailureOnCall === transactionCalls.length) throw state.failure ?? new Error('Transaction query failed')
            return { rows: [] }
        })
    },
}))

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async (request: { headers: Record<string, string | string[] | undefined> }) => {
        const id = request.headers.id
        return typeof id === 'string' ? { valid: true, id } : { valid: false }
    },
}))

const { default: browserSandboxProfileRoutes } = await import('../../src/routes/browserSandboxProfiles.ts')
const { default: ensureBrowserBillingSchema } = await import('../../src/utils/db/browserBillingSchema.ts')

beforeEach(resetFixture)
afterEach(() => {
    calls.length = 0
    transactionCalls.length = 0
})

export async function createApp() {
    const app = Fastify({ logger: false })
    await app.register(browserSandboxProfileRoutes)
    return app
}

export async function ensureProfileSchema() {
    await ensureBrowserBillingSchema()
}

function resetFixture() {
    calls.length = 0
    transactionCalls.length = 0
    state.rows = []
    state.failure = undefined
    state.transactionCount = 0
    state.transactionFailureOnCall = undefined
}
