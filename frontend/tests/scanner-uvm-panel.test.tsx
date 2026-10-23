// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { data, noop } from './scanner-uvm-panel.fixture'
import UvmPanel, { filterAndSortUvmFindings } from '../src/app/dashboard/scanner/uvmPanel'
import { UvmAssessmentStarter, UvmAssetsView, UvmHelp } from '../src/app/dashboard/scanner/uvmPanelViews'
import { UvmActivityAndSchedules } from '../src/app/dashboard/scanner/uvmPanelActivity'
import { isNmapScanProfile } from '../src/app/dashboard/scanner/uvmPanelHelpers'
import { UvmAssessmentEngineChoices } from '../src/app/dashboard/scanner/uvmPanelAssessmentControls'

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
    expect(html).toContain('Nmap inventories selected TCP or UDP services')
    expect(html).toContain('About Assessment scope and engines')
    expect(html).toContain('1 verified asset')
    expect(html).toContain('New assessment')
    expect(html).toContain('Choose scope and scanners')
    expect(html).toContain('Recent activity')
    expect(html).toContain('All runs')
    expect(html).toContain('1 open TCP port · service inventory only')
    expect(html).toContain('Upcoming schedules')
    expect(html).toContain('No recurring assessments enabled.')
    expect(html).toContain('Active scans')
    expect(html).toContain('Open findings')
    expect(html).toContain('Address coverage 1/1')
    expect(html).toContain('Scan history')
    expect(html).toContain('Findings')
    expect(html).not.toContain('Cancel scan')
})

test('unavailable Scanner API shows unknown state instead of empty-result counts', () => {
    const html = renderToStaticMarkup(<UvmPanel initialData={{
        assets: [], coverage: [], engines: [], runs: [], assessments: [], findings: [], tenableScans: [],
        scannerError: 'Failed to fetch', tenableIntegration: null,
    }}
    refreshAction={async() => { throw new Error('Failed to fetch') }}
    createAssetAction={noop} verifyAssetAction={noop} runScanAction={noop} scheduleAction={noop}
    configureTenableAction={noop} disconnectTenableAction={noop} runTenableScanAction={noop}
    updateFindingAction={noop} cancelRunAction={noop} startAssessmentAction={noop} cancelAssessmentAction={noop}
    />)

    expect(html).toContain('Scanner API offline.')
    expect(html).toContain('Assessment readiness')
    expect(html).toContain('Scanner status unavailable: Failed to fetch')
    expect(html).toContain('Assessments (—)')
    expect(html).toContain('Findings (—)')
    expect(html).toContain('Active scans')
    expect(html).toContain('Open findings')
    expect(html).toContain('Coverage unavailable: Failed to fetch')
    expect(html).toContain('Activity unavailable while Scanner is offline.')
    expect(html).toContain('Schedule status unavailable while Scanner is offline.')
    expect(html).not.toContain('No scan runs yet.')
    expect(html).not.toContain('No findings imported')
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
    expect(html).toContain('0 verified assets · 0 engines ready')
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
    expect(html).toContain('No engines ready.')
})

test('asset controls expose standard Nmap coverage and recurring Greenbone scans', () => {
    const noopSetter = (() => undefined) as never
    const html = renderToStaticMarkup(<UvmAssetsView
        data={{ ...data, engines: [...data.engines, { id: 'gvm', name: 'Greenbone', status: 'available', version: null, reason: null, profiles: [], coverage: [], notCovered: [] }] }}
        busy='' message='' hostname='' setHostname={noopSetter} authorization={{ 'asset-1': true }} setAuthorization={noopSetter}
        intervals={{}} setIntervals={noopSetter} schedulePlans={{}} setSchedulePlans={noopSetter} scheduleProfiles={{}} setScheduleProfiles={noopSetter}
        assetNmapProfiles={{}} setAssetNmapProfiles={noopSetter} zapApiDefinitionPaths={{}} setZapApiDefinitionPaths={noopSetter}
        onSaveZapApiDefinition={() => undefined} scheduleScanIds={{}} setScheduleScanIds={noopSetter} tenableScanIds={{}} setTenableScanIds={noopSetter}
        onRefresh={() => undefined} onAddAsset={() => undefined} onVerify={() => undefined} onScan={() => undefined}
        onScanWithTenable={() => undefined} onScanWithGvm={() => undefined} onScanWithZap={() => undefined} onSchedule={() => undefined}
    />)
    expect(html).toContain('Standard · top 1,000')
    expect(html).toContain('Run Greenbone scan')
    expect(html).toContain('Quick · top 100')
    expect(html).toContain('UDP · top 100')
})

test('UDP profile is accepted and recent activity keeps ambiguous ports distinct', () => {
    expect(isNmapScanProfile('udp-top-100')).toBe(true)
    expect(isNmapScanProfile('udp-all')).toBe(false)
    const html = renderToStaticMarkup(<UvmActivityAndSchedules data={{ ...data, runs: [{
        ...data.runs[0], profile: 'udp-top-100', coverage: { known: true, requestedAddresses: 1, attemptedAddresses: 1, completedAddresses: 1 },
        hosts: [{ address: '8.8.8.8', status: 'up', timedOut: false, ports: [
            { port: 53, protocol: 'udp', state: 'open|filtered', service: 'domain', product: null, version: null, extraInfo: null },
        ] }],
    }] }} onViewRuns={() => undefined} onManageAssets={() => undefined} />)
    expect(html).toContain('0 open · 1 open|filtered UDP · UDP inventory')
})

test('manual assessment profile selector includes the bounded UDP option', () => {
    const noopSetter = (() => undefined) as never
    const html = renderToStaticMarkup(<UvmAssessmentEngineChoices data={data} selectedEngines={['nmap']}
        setSelectedEngines={noopSetter} scanId='' setScanId={noopSetter} nmapProfile='udp-top-100'
        setNmapProfile={noopSetter} servicesPaused={false} onSetup={() => undefined} />)
    expect(html).toContain('UDP · top 100 ports')
    expect(html).toContain('UDP results may be open or open|filtered.')
})
