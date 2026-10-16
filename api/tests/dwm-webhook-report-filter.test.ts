import { expect, test } from 'bun:test'
import './fixtures/dwm-webhook-report-retry-setup.ts'
import { queries } from './fixtures/dwm-webhook-report-retry-state.ts'
import { failedDeliveryFixture } from './fixtures/dwm-webhook-report-retry-data.ts'

test('builds exact report filters into the delivery query before its row limit', async () => {
    const { listDwmWebhookDeliveries } = await import('../src/utils/dwm/webhooks.ts')
    await listDwmWebhookDeliveries('member_2', 'org_1', {
        alertId: 'alert_1',
        reportCaseId: 'case_1',
        reportExportChecksum: 'case_report_exact',
    })
    const query = queries.at(-1)
    expect(query?.params).toEqual(['org_1', 'alert_1', 'case_1', 'case_report_exact'])
    expect(query?.sql).toContain('metadata->>\'reportValidation\' AS report_validation')
    expect(query?.sql).toContain('audit.report_validation = \'valid\'')
    expect(query?.sql.indexOf('deliveries.alert_id = $2')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
    expect(query?.sql.indexOf('audit.report_case_id = $3')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
    expect(query?.sql.indexOf('audit.report_export_checksum = $4')).toBeLessThan(query?.sql.indexOf('LIMIT 100') ?? -1)
})


test('exposes report identity from the persisted delivery audit projection', async () => {
    const { buildDwmWebhookDeliveryLedger, toDwmWebhookDelivery } = await import('../src/utils/dwm/webhooks.ts')
    const row = {
        ...failedDeliveryFixture('2020-07-23T10:01:00.000Z'),
        report_validation: 'valid',
        report_export_checksum: 'case_report_exact',
        report_case_id: 'case_1',
    }
    const ledger = buildDwmWebhookDeliveryLedger({
        deliveries: [toDwmWebhookDelivery(row)],
        filters: { reportCaseId: 'case_1', reportExportChecksum: 'case_report_exact' },
    })
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({
        reportValidation: 'valid',
        reportExportChecksum: 'case_report_exact',
        reportCaseId: 'case_1',
        thirdPartyReport: true,
    })
})
