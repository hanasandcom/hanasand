// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { UvmDashboard } from '../src/utils/monitoring/types'
import UvmPanel, { filterAndSortUvmFindings } from '../src/app/dashboard/scanner/uvmPanel'
import { UvmAssessmentStarter, UvmAssetsView, UvmHelp } from '../src/app/dashboard/scanner/uvmPanelViews'

const data: UvmDashboard = {
    assets: [{
        id: 'asset-1', hostname: 'example.com', verificationStatus: 'verified',
        verificationRecordName: '_hanasand-security-verification.example.com',
        verificationRecordValue: 'hanasand-security-verification=challenge', verificationMethod: 'dns_txt',
        verifiedAt: new Date(0).toISOString(), scanAuthorizedAt: new Date(0).toISOString(),
        authorizedAddresses: ['8.8.8.8'], scheduleEnabled: false, scheduleEngine: 'nmap', scheduleScanId: null, scheduleProfile: 'tcp-top-1000', intervalMinutes: 60,
        nextRunAt: null, createdAt: new Date(0).toISOString(),
    }],
    engines: [{ id: 'nmap', name: 'Nmap', status: 'available', version: '7.98', reason: null,
        profiles: [{ id: 'tcp-top-100', name: 'TCP ports and service versions', safe: true }],
        coverage: ['Top 100 TCP ports', 'Light service version detection'],
        notCovered: ['UDP', 'Vulnerability scripts'],
    }, { id: 'tenable-vm', name: 'Tenable Vulnerability Management', status: 'available', version: null, reason: null,
        profiles: [{ id: 'scan-1', name: 'External perimeter', safe: true }], coverage: ['Tenable scan configuration'], notCovered: ['Autonomous exploitation'],
    }],
    runs: [{
        id: 'run-1', scannerRunId: 'remote-1', requestId: 'request-1', assetId: 'asset-1', target: 'example.com',
        engine: 'nmap', profile: 'tcp-top-100', source: 'manual', status: 'succeeded',
        createdAt: new Date(0).toISOString(), startedAt: new Date(0).toISOString(), finishedAt: new Date(0).toISOString(),
        error: null, hosts: [{ address: '8.8.8.8', status: 'up', timedOut: false, ports: [{ port: 443, protocol: 'tcp', state: 'open', service: 'https', product: 'Example', version: '1.0', extraInfo: null }] }],
        engineVersion: '7.98', rawXmlSha256: 'abc123', coverage: { known: true, requestedAddresses: 1, attemptedAddresses: 1, completedAddresses: 1, completedAddressList: ['8.8.8.8'], missingAddresses: [], unattemptedAddresses: [], openPorts: 1 },
    }, {
        id: 'run-2', scannerRunId: 'remote-2', requestId: 'request-2', assetId: 'asset-1', target: 'example.com',
        engine: 'tenable-vm', profile: 'scan-1', source: 'manual', status: 'succeeded', createdAt: new Date(0).toISOString(),
        startedAt: new Date(0).toISOString(), finishedAt: new Date(0).toISOString(), error: null, hosts: [], findings: [],
        engineVersion: null, rawXmlSha256: null, coverage: { attemptedAddresses: 1, completedAddresses: 1 },
    }, {
        id: 'run-3', scannerRunId: 'remote-3', requestId: 'request-3', assetId: 'asset-1', target: 'example.com',
        engine: 'nmap', profile: 'tcp-top-100', source: 'manual', status: 'running', createdAt: new Date(0).toISOString(),
        startedAt: new Date(0).toISOString(), finishedAt: null, error: null, hosts: [], engineVersion: '7.98', rawXmlSha256: null,
        coverage: { requestedAddresses: 1, attemptedAddresses: 0, completedAddresses: 0, unattemptedAddresses: ['8.8.8.8'] },
    }],
    assessments: [],
    scannerError: null,
    tenableIntegration: { provider: 'tenable-vm', configured: true, credentialStoreAvailable: true, region: 'eu', accessKeyHint: '••••1234', testedAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), error: null },
    tenableScans: [{ id: 'scan-1', scheduleUuid: null, name: 'External perimeter', enabled: true, status: 'ready', scannerName: 'cloud', targets: 'example.com' }],
    findings: [
        { id: 'finding-1', assetId: 'asset-1', asset: 'example.com', address: '8.8.8.8', engine: 'tenable-vm', externalId: '12345:8.8.8.8', title: 'Example plugin finding', severity: 'high', cvssScore: 8.1, cveIds: ['CVE-2025-0001'], description: 'Affected version detected.', solution: 'Update the package.', evidence: 'Plugin output', status: 'open', triageNote: null, firstSeen: new Date(0).toISOString(), lastSeen: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
        { id: 'finding-2', assetId: 'asset-1', asset: 'example.com', address: null, engine: 'hanasand-web', externalId: 'https://example.com:header.csp', title: 'Content-Security-Policy is present', severity: 'medium', cvssScore: null, cveIds: [], description: 'The response did not include a Content-Security-Policy header.', solution: null, evidence: '{"value":null}', status: 'open', triageNote: null, firstSeen: new Date(0).toISOString(), lastSeen: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
    ],
}

const noop = async() => ({}) as never

test('overview shows compact readiness, honest coverage, and clear next actions', () => {
    const html = renderToStaticMarkup(<UvmPanel initialData={data}
        refreshAction={async() => data}
        createAssetAction={noop}
        verifyAssetAction={noop}
        runScanAction={noop}
        scheduleAction={noop}
        configureTenableAction={noop}
        disconnectTenableAction={noop}
        runTenableScanAction={noop}
        updateFindingAction={noop}
        cancelRunAction={noop}
        startAssessmentAction={noop}
        cancelAssessmentAction={noop}
    />)

    expect(html).toContain('example.com')
    expect(html).toContain('Security scanner')
    expect(html).toContain('Nmap inventories TCP services; GVM and Tenable VM check vulnerabilities.')
    expect(html).toContain('About Assessment scope and engines')
    expect(html).toContain('Scans do not validate exploitability.')
    expect(html).toContain('1 verified asset')
    expect(html).toContain('New assessment')
    expect(html).toContain('Choose scope and scanners')
    expect(html).toContain('Standalone Nessus Pro is not connected.')
    expect(html).toContain('About Latest scan')
    expect(html).toContain('A partial or unreported result does not confirm that an asset is clear.')
    expect(html).toContain('Active scans')
    expect(html).toContain('Open findings')
    expect(html).toContain('Address coverage 1/1')
    expect(html).toContain('Scan history')
    expect(html).toContain('Assets')
    expect(html).toContain('Findings')
    expect(html).not.toContain('Recent scanner runs')
    expect(html).not.toContain('Cancel scan')
})

test('finding filters search CVEs, assets, and scanner metadata', () => {
    const filters = { query: 'cve-2025-0001', engine: 'all', severity: 'all', status: 'all', asset: 'all' }
    expect(filterAndSortUvmFindings(data.findings, filters).map(finding => finding.id)).toEqual(['finding-1'])
    expect(filterAndSortUvmFindings(data.findings, { ...filters, query: '', engine: 'hanasand-web' }).map(finding => finding.id)).toEqual(['finding-2'])
    expect(filterAndSortUvmFindings(data.findings, { ...filters, query: '', asset: 'asset-1' })).toHaveLength(2)
})

test('finding filters default to actionable statuses and order severity before age', () => {
    const resolved = { ...data.findings[0], id: 'finding-resolved', status: 'resolved' as const, severity: 'critical' }
    const olderLow = { ...data.findings[1], id: 'finding-low', severity: 'low', firstSeen: '2020-01-01T00:00:00.000Z' }
    const newerHigh = { ...data.findings[1], id: 'finding-high', severity: 'high', firstSeen: '2025-01-01T00:00:00.000Z' }
    const results = filterAndSortUvmFindings([olderLow, resolved, newerHigh], { query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' })
    expect(results.map(finding => finding.id)).toEqual(['finding-high', 'finding-low'])
})

test('technical help uses a named keyboard-operable disclosure', () => {
    const html = renderToStaticMarkup(<UvmHelp label='Nmap coverage' text='Nmap reports TCP service inventory.' />)
    expect(html).toContain('<details')
    expect(html).toContain('aria-label="About Nmap coverage"')
    expect(html).toContain('Nmap reports TCP service inventory.')
    expect(html).not.toContain('<details open')
})

test('first-run guide points to asset verification and scanner setup when neither is ready', () => {
    const html = renderToStaticMarkup(<UvmAssessmentStarter
        data={{ ...data, assets: [], engines: [], scannerError: null }}
        onManageAssets={() => undefined}
        onConfigureScanners={() => undefined}
        onStartAssessment={() => undefined}
    />)

    expect(html).toContain('0 verified assets')
    expect(html).toContain('Add and verify an asset')
    expect(html).toContain('0 engines ready · 0 unavailable')
    expect(html).toContain('Scanner setup')

    const configureHtml = renderToStaticMarkup(<UvmAssessmentStarter
        data={{ ...data, engines: [] }}
        onManageAssets={() => undefined}
        onConfigureScanners={() => undefined}
        onStartAssessment={() => undefined}
    />)
    expect(configureHtml).toContain('Configure a scanner')
})

test('configured Tenable without an enabled scan is not shown as a ready engine', () => {
    const html = renderToStaticMarkup(<UvmAssessmentStarter
        data={{ ...data, engines: data.engines.filter(engine => engine.id === 'tenable-vm'), tenableScans: [] }}
        onManageAssets={() => undefined}
        onConfigureScanners={() => undefined}
        onStartAssessment={() => undefined}
    />)

    expect(html).toContain('Configure a scanner')
    expect(html).toContain('0 engines ready · 1 unavailable')
    expect(html).toContain('Connect Tenable VM and enable a network scan configuration.')
})

test('asset controls expose standard Nmap coverage and recurring Greenbone scans', () => {
    const noopSetter = (() => undefined) as never
    const html = renderToStaticMarkup(<UvmAssetsView
        data={{ ...data, engines: [...data.engines, { id: 'gvm', name: 'Greenbone', status: 'available', version: null, reason: null, profiles: [], coverage: [], notCovered: [] }] }}
        busy='' message='' hostname='' setHostname={noopSetter} authorization={{ 'asset-1': true }} setAuthorization={noopSetter}
        intervals={{}} setIntervals={noopSetter} scheduleEngines={{}} setScheduleEngines={noopSetter} scheduleProfiles={{}} setScheduleProfiles={noopSetter}
        assetNmapProfiles={{}} setAssetNmapProfiles={noopSetter} scheduleScanIds={{}} setScheduleScanIds={noopSetter} tenableScanIds={{}} setTenableScanIds={noopSetter}
        onRefresh={() => undefined} onAddAsset={() => undefined} onVerify={() => undefined} onScan={() => undefined} onScanWithTenable={() => undefined} onSchedule={() => undefined}
    />)
    expect(html).toContain('Standard · top 1,000')
    expect(html).toContain('Greenbone vulnerability scan')
    expect(html).toContain('Quick · top 100')
})
