// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { UvmAsset, UvmDashboard } from '../src/utils/monitoring/types'
import { UvmActivityAndSchedules } from '../src/app/dashboard/scanner/uvmPanelActivity'

const asset: UvmAsset = {
    id: 'asset-1', hostname: 'example.com', verificationStatus: 'verified',
    verificationRecordName: '_hanasand-security-verification.example.com',
    verificationRecordValue: 'hanasand-security-verification=challenge', verificationMethod: 'dns_txt',
    verifiedAt: null, scanAuthorizedAt: null, authorizedAddresses: [], scheduleEnabled: true,
    scheduleEngine: 'nmap', scheduleScanId: null, scheduleProfile: 'tcp-top-1000', intervalMinutes: 60,
    nextRunAt: '2026-10-23T18:00:00.000Z', createdAt: new Date(0).toISOString(),
}
const data: UvmDashboard = {
    assets: [asset], coverage: [], engines: [], runs: [], assessments: [], scannerError: null,
    tenableIntegration: null, tenableScans: [], findings: [],
}

test('upcoming schedules show cadence and next run for the configured asset', () => {
    const html = renderToStaticMarkup(<UvmActivityAndSchedules data={data} onViewRuns={() => undefined} onManageAssets={() => undefined} />)

    expect(html).toContain('Upcoming schedules')
    expect(html).toContain('Manual · every 60 min · next')
    expect(html).toContain('example.com')
    expect(html).not.toContain('No recurring assessments enabled.')
})

test('offline Scanner state does not claim there are no scans or schedules', () => {
    const html = renderToStaticMarkup(<UvmActivityAndSchedules data={{ ...data, scannerError: 'API unavailable' }} onViewRuns={() => undefined} onManageAssets={() => undefined} />)

    expect(html).toContain('Activity unavailable while Scanner is offline.')
    expect(html).toContain('Schedule status unavailable while Scanner is offline.')
    expect(html).not.toContain('No recurring assessments enabled.')
})
