import { expect, test } from 'bun:test'
import { vmDeletionScheduledMail } from '../src/utils/vms/deletionMail.ts'

test('VM deletion notice identifies the actor, deadline and available access context', () => {
    const message = vmDeletionScheduledMail({
        vmName: '<cashflow>', actorId: 'eirik', scheduledAt: '2026-10-20T10:00:00.000Z',
        deleteAfter: '2026-11-19T10:00:00.000Z', ip: '203.0.113.4', city: 'Oslo', region: 'Oslo', country: 'Norway',
    })

    expect(message.subject).toContain('<cashflow>')
    expect(message.textBody).toContain('Scheduled by: @eirik')
    expect(message.textBody).toContain('Permanent deletion after (UTC): 2026-11-19T10:00:00.000Z')
    expect(message.textBody).toContain('IP address: 203.0.113.4')
    expect(message.htmlBody).toContain('&lt;cashflow&gt;')
    expect(message.htmlBody).toContain('Review or restore this VM')
})
