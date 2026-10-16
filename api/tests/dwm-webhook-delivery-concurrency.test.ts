import { expect, test } from 'bun:test'
import { withLiveDelivery } from './fixtures/dwm-webhook-report-retry-env.ts'
import './fixtures/dwm-webhook-report-retry-setup.ts'
import { ledger } from './fixtures/dwm-webhook-report-retry-state.ts'
import { deliveryInput } from './fixtures/dwm-webhook-report-retry-data.ts'

test('serializes the same org destination checksum across two admins', async () => {
    const { deliverDwmAlertNotification } = await import('../src/utils/dwm/webhooks.ts')
    let networkAttempts = 0
    const sender = async () => {
        networkAttempts += 1
        await Bun.sleep(10)
        return { status: 204, body: '' }
    }
    const input = deliveryInput('checksum_concurrent', false)
    await withLiveDelivery(async () => {
        const [first, second] = await Promise.all([
            deliverDwmAlertNotification('owner_1', input, sender),
            deliverDwmAlertNotification('member_2', input, sender),
        ])
        expect(networkAttempts).toBe(1)
        expect([first[0]?.status, second[0]?.status].sort()).toEqual(['delivered', 'skipped'])
        expect(new Set(ledger.map(row => row.owner_id))).toEqual(new Set(['owner_1', 'member_2']))
        expect(new Set(ledger.map(row => row.idempotency_key))).toEqual(new Set([
            'dwm.alert.updated:org_1:destination_1:checksum_concurrent',
        ]))
        expect(ledger.filter(row => !row.dry_run && row.attempted_at)).toHaveLength(1)
    })
})
