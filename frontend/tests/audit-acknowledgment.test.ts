import { afterEach, expect, mock, test } from 'bun:test'

mock.module('@/utils/cookies/cookies', () => ({ getCookie: (name: string) => name === 'id' ? 'operator-7' : 'token-7' }))
const { saveAuditAcknowledgment } = await import('../src/app/dashboard/audit/acknowledgment')
const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

test('audit acknowledgment shares authenticated set and clear requests', async () => {
    const calls: Array<{ url: string, options?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
        calls.push({ url: String(url), options })
        return Response.json({ acknowledged_at: '2026-10-17T12:00:00Z', acknowledged_by: 'operator-7' })
    }) as typeof fetch

    await expect(saveAuditAcknowledgment(42, false, 'Save failed')).resolves.toEqual({
        acknowledgedAt: '2026-10-17T12:00:00Z', acknowledgedBy: 'operator-7',
    })
    await saveAuditAcknowledgment(42, true, 'Clear failed')
    expect(calls.map(call => [call.url.split('/admin/')[1], call.options?.method])).toEqual([
        ['audit-events/42/acknowledgment', 'POST'],
        ['audit-events/42/acknowledgment', 'DELETE'],
    ])
    for (const call of calls) {
        const headers = new Headers(call.options?.headers)
        expect(headers.get('Authorization')).toBe('Bearer token-7')
        expect(headers.get('id')).toBe('operator-7')
    }
})

test('audit acknowledgment preserves server errors and normalizes cleared values', async () => {
    globalThis.fetch = (async () => Response.json({ acknowledged_at: null, acknowledged_by: null })) as typeof fetch
    await expect(saveAuditAcknowledgment(8, true, 'fallback')).resolves.toEqual({ acknowledgedAt: null, acknowledgedBy: null })

    globalThis.fetch = (async () => Response.json({ error: 'Not permitted.' }, { status: 403 })) as typeof fetch
    await expect(saveAuditAcknowledgment(8, false, 'fallback')).rejects.toThrow('Not permitted.')

    globalThis.fetch = (async () => Response.json({}, { status: 500 })) as typeof fetch
    await expect(saveAuditAcknowledgment(8, false, 'Could not save acknowledgment.')).rejects.toThrow('Could not save acknowledgment.')
})
