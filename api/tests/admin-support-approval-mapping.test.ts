import { expect, test } from 'bun:test'
import { normalizeAuditEventList } from '../src/handlers/adminSupport/cases/accessRecoveryApprovalMapping.ts'

test('approval audit events retain the compact normalized projection', () => {
    expect(normalizeAuditEventList([
        { id: '12', actionType: '  support.inspect  ', outcome: 'success', severity: 'info', createdAt: ' 2026-01-01 ', secret: 'omit' },
        { id: 'invalid', actionType: 'other', outcome: null, severity: 5, createdAt: undefined },
        null,
        'not-an-event',
    ])).toEqual([
        { id: 12, actionType: 'support.inspect', outcome: 'success', severity: 'info', createdAt: '2026-01-01' },
        { id: 0, actionType: 'other', outcome: '', severity: '', createdAt: '' },
    ])
    expect(normalizeAuditEventList(JSON.stringify([{ id: 1 }]))).toEqual([])
})
