import { expect, mock, test } from 'bun:test'

const queries: Array<{ sql: string, params: unknown[] }> = []
mock.module('../src/constants.ts', () => ({ default: { internal_api: 'http://internal.test', vm_api_token: 'test-token' } }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (sql.includes('deleted_at IS NOT NULL')) return { rows: [] }
    return { rows: [{ public_key: 'ssh-ed25519 AAA key' }] }
} }))

const syncUserCertificatesToVm = (await import('../src/utils/vms/syncUserCertificatesToVm.ts')).default

test('certificate sync normalizes user IDs and preserves zero counts from the VM', async () => {
    const originalFetch = globalThis.fetch
    let requestBody: { keys: string[] } | undefined
    globalThis.fetch = async (_input, init) => {
        expect(new Headers(init?.headers).get('User-Agent')).toBe('hanasand_internal')
        requestBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({ received: 0, added: 0, total: 0 }), { status: 200 })
    }
    queries.length = 0

    try {
        const result = await syncUserCertificatesToVm({ vmName: 'cashflow', userIds: [' alice ', 'alice', '', 'bob'] })

        expect(queries.find(query => query.sql.includes('ANY($1::text[])'))?.params).toEqual([['alice', 'bob'], 'cashflow'])
        expect(requestBody).toEqual({ keys: ['ssh-ed25519 AAA key'] })
        expect(result).toEqual({ ok: true, received: 0, added: 0, total: 0, certificates: ['ssh-ed25519 AAA key'] })
    } finally {
        globalThis.fetch = originalFetch
    }
})
