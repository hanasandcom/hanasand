import { afterEach, expect, mock, test } from 'bun:test'
import type { AuditPage } from '../src/app/dashboard/management/audit/data'

mock.module('@/utils/cookies/cookies', () => ({ getCookie: (name: string) => name === 'id' ? 'operator-7' : 'token-7' }))
const { performAuditAcknowledgment } = await import('../src/app/dashboard/audit/useAuditAcknowledgment')
const { helpdeskAcknowledgmentFields } = await import('../src/app/dashboard/helpdesk/audit')
const { isFailedAuditEvent, updateAuditAcknowledgment } = await import('../src/app/dashboard/management/audit/data')
const originalFetch = globalThis.fetch

afterEach(() => { globalThis.fetch = originalFetch })

test('shared acknowledgment lifecycle resets errors, marks pending, saves, and clears pending', async () => {
    globalThis.fetch = (async () => Response.json({ acknowledged_at: '2026-10-17T12:00:00Z', acknowledged_by: 'operator-7' })) as typeof fetch
    const pending: Array<number | null> = []
    const errors: Array<{ id: number, message: string } | null> = [{ id: 8, message: 'old error' }]
    const saved: Array<{ id: number, at: string | null, by: string | null }> = []

    await performAuditAcknowledgment({
        eventId: 42,
        acknowledged: false,
        onSaved: (id, result) => saved.push({ id, at: result.acknowledgedAt, by: result.acknowledgedBy }),
        setPendingEvent: value => pending.push(value),
        setAcknowledgmentError: value => errors.push(value),
        errorFallback: 'Helpdesk fallback.',
    })

    expect(pending).toEqual([42, null])
    expect(errors).toEqual([{ id: 8, message: 'old error' }, null])
    expect(saved).toEqual([{ id: 42, at: '2026-10-17T12:00:00Z', by: 'operator-7' }])
})

test('shared acknowledgment lifecycle keeps event identity and screen-specific unknown-error fallback', async () => {
    globalThis.fetch = (() => Promise.reject('network failed')) as typeof fetch
    const pending: Array<number | null> = []
    const errors: Array<{ id: number, message: string } | null> = []

    await performAuditAcknowledgment({
        eventId: 7,
        acknowledged: true,
        onSaved: () => { throw new Error('Must not save after a failed request.') },
        setPendingEvent: value => pending.push(value),
        setAcknowledgmentError: value => errors.push(value),
        errorFallback: 'Could not save acknowledgment. Try again.',
    })

    await performAuditAcknowledgment({
        eventId: 8,
        acknowledged: false,
        onSaved: () => { throw new Error('Must not save after a failed request.') },
        setPendingEvent: value => pending.push(value),
        setAcknowledgmentError: value => errors.push(value),
        errorFallback: 'Could not save acknowledgment.',
    })

    expect(pending).toEqual([7, null, 8, null])
    expect(errors).toEqual([
        null,
        { id: 7, message: 'Could not save acknowledgment. Try again.' },
        null,
        { id: 8, message: 'Could not save acknowledgment.' },
    ])
})

test('Helpdesk acknowledgment maps snake_case fields and clears the recorded name', () => {
    expect(helpdeskAcknowledgmentFields({ acknowledgedAt: 'at', acknowledgedBy: 'id' })).toEqual({
        acknowledged_at: 'at', acknowledged_by: 'id', acknowledged_by_name: null,
    })
})

test('Management updates only the selected event and retains its recorded name', () => {
    const page = {
        events: [
            { id: 7, happenedAt: 'old', actor: 'A', service: 'auth', action: 'login', target: 'user', result: 'failed', detail: '', severity: 'warning', source: 'api', actorId: 'a', targetName: 'User', organization: '', entity: '', request: '', ip: '', acknowledgedAt: null, acknowledgedBy: null, acknowledgedByName: 'Historical Operator' },
            { id: 8, happenedAt: 'other', actor: 'B', service: 'api', action: 'read', target: 'case', result: 'success', detail: '', severity: 'info', source: 'api', actorId: 'b', targetName: 'Case', organization: '', entity: '', request: '', ip: '', acknowledgedAt: null, acknowledgedBy: null, acknowledgedByName: null },
        ],
        available: true,
        total: 2,
        nextCursor: null,
    } satisfies AuditPage

    const updated = updateAuditAcknowledgment(page, 7, { acknowledgedAt: '2026-10-17T12:00:00Z', acknowledgedBy: 'operator-7' })

    expect(updated.events[0]).toMatchObject({
        id: 7, acknowledgedAt: '2026-10-17T12:00:00Z', acknowledgedBy: 'operator-7', acknowledgedByName: 'Historical Operator',
    })
    expect(updated.events[1]).toEqual(page.events[1])
    expect(page.events[0]?.acknowledgedAt).toBeNull()
})

test('audit failure classification is shared by metrics and row styling', () => {
    const event = (result: string) => ({ result })
    for (const result of ['ok', 'ready', 'success', 'completed', 'published', 'SUCCESS']) {
        expect(isFailedAuditEvent(event(result))).toBe(false)
    }
    for (const result of ['failed', 'error', '']) expect(isFailedAuditEvent(event(result))).toBe(true)
})
