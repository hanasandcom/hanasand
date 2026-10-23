// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { UvmAssetEngineCoverage, UvmDashboard } from '../src/utils/monitoring/types'
import { UvmAssetEngineCoverageView } from '../src/app/dashboard/scanner/uvmPanelCoverageView'

const data: UvmDashboard = {
    assets: [{
        id: 'asset-1', hostname: 'example.com', verificationStatus: 'verified',
        verificationRecordName: '_hanasand-security-verification.example.com', verificationRecordValue: 'synthetic',
        verificationMethod: 'dns_txt', verifiedAt: null, scanAuthorizedAt: null, authorizedAddresses: [],
        scheduleEnabled: false, scheduleEngine: 'nmap', scheduleScanId: null, scheduleProfile: 'tcp-top-1000',
        intervalMinutes: 60, nextRunAt: null, createdAt: new Date(0).toISOString(),
    }],
    engines: [], runs: [], assessments: [], scannerError: null, tenableIntegration: null, tenableScans: [], findings: [],
}

test('web coverage distinguishes unavailable findings from measured zero and positive counts', () => {
    const coverage: UvmAssetEngineCoverage = {
        assetId: 'asset-1', engine: 'zap', state: 'unknown', freshness: 'unknown',
        lastRunId: null, lastRunAt: null, source: null, profile: null, status: null,
        authorizedAddresses: [], requestedAddresses: [], coverageKnown: false,
        attemptedAddresses: null, reportedAttemptedAddresses: null, reportedCompletedAddresses: null,
        completedAddresses: null, completedAddressList: null, missingAddresses: null, unattemptedAddresses: null,
        scopeMatchesAuthorizedSnapshot: null, freshnessWindowHours: 24, ageHours: null, freshnessReason: 'No report.',
    }
    const measured = (acceptedInstances: number): NonNullable<UvmAssetEngineCoverage['webCoverage']> => ({
        origin: 'https://example.com', requestedAddresses: 1, confirmedAddresses: ['8.8.8.8'],
        urlsVisited: null, totalAlerts: acceptedInstances, acceptedAlerts: acceptedInstances, acceptedInstances,
        scopeFiltered: false, truncated: false, truncationReasons: [], complete: true,
    })
    const cases = [
        { row: coverage, label: 'Findings unavailable' },
        { row: { ...coverage, webCoverage: null }, label: 'Findings unavailable' },
        { row: { ...coverage, webCoverage: measured(0) }, label: '0 findings' },
        { row: { ...coverage, webCoverage: measured(7) }, label: '7 findings' },
    ]
    for (const { row, label } of cases) {
        const html = renderToStaticMarkup(<UvmAssetEngineCoverageView data={{ ...data, coverage: [row] }} />)
        expect(html).toContain(label)
        expect(html).toContain('URL count unavailable')
        expect(html).toContain('browser URL count unavailable')
        if (!row.webCoverage) expect(html).not.toContain('0 findings')
        else expect(html).not.toContain('Findings unavailable')
    }

    const withBrowserCoverage = renderToStaticMarkup(<UvmAssetEngineCoverageView data={{
        ...data,
        coverage: [{ ...coverage, webCoverage: { ...measured(3), urlsDiscovered: 12, clientUrlsDiscovered: 18 } }],
    }} />)
    expect(withBrowserCoverage).toContain('12 traditional')
    expect(withBrowserCoverage).toContain('18 browser routes')
})
