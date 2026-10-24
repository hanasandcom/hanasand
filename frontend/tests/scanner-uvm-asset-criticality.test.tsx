// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { data, noop } from './scanner-uvm-panel.fixture'
import { UvmAssetsView } from '../src/app/dashboard/scanner/uvmPanelViews'
import { filterAndSortUvmFindings } from '../src/app/dashboard/scanner/uvmPanelHelpers'

test('asset importance is editable and its manual provenance is visible', () => {
    const set = (() => undefined) as never
    const props = {
        data, busy: '', message: '', hostname: '', setHostname: set, authorization: {}, setAuthorization: set,
        intervals: {}, setIntervals: set, schedulePlans: {}, setSchedulePlans: set, scheduleProfiles: {}, setScheduleProfiles: set,
        assetNmapProfiles: {}, setAssetNmapProfiles: set, zapApiDefinitionPaths: {}, setZapApiDefinitionPaths: set,
        onSaveCriticality: noop, scheduleScanIds: {}, setScheduleScanIds: set, tenableScanIds: {}, setTenableScanIds: set,
        onRefresh: noop, onAddAsset: noop, onVerify: noop, onSaveZapApiDefinition: noop, onScan: noop, onScanWithNaabu: noop,
        onScanWithAngryIp: noop, onScanWithTenable: noop, onScanWithGvm: noop, onScanWithZap: noop, onScanWithTestssl: noop,
        onScanWithNuclei: noop, onScanWithNikto: noop, onScanWithSslyze: noop, onScanWithWapiti: noop, onScanWithWhatweb: noop,
        onScanWithHttpx: noop, onScanWithTlsx: noop, onScanWithKatana: noop, onScanWithWafw00f: noop, onSchedule: noop,
    }
    const html = renderToStaticMarkup(<UvmAssetsView {...props} />)
    expect(html).toContain('Asset importance for example.com')
    expect(html).toContain('value="high" selected')
    expect(html).toContain('Manual ·')
})

test('importance-first sorting keeps scanner severity separate and puts unset assets last', () => {
    const critical = { ...data.findings[1], id: 'critical-asset-medium', assetId: 'asset-critical', severity: 'medium' }
    const unassigned = { ...data.findings[0], id: 'unassigned-high', assetId: 'asset-unassigned', severity: 'high' }
    const assets = [
        { ...data.assets[0], id: 'asset-critical', criticality: 'critical' as const },
        { ...data.assets[0], id: 'asset-unassigned', criticality: 'unset' as const },
    ]
    const filters = { query: '', engine: 'all', severity: 'all', status: 'all', asset: 'all' }
    expect(filterAndSortUvmFindings([unassigned, critical], filters, assets, 'severity').map(item => item.id)).toEqual(['unassigned-high', 'critical-asset-medium'])
    expect(filterAndSortUvmFindings([unassigned, critical], filters, assets, 'criticality').map(item => item.id)).toEqual(['critical-asset-medium', 'unassigned-high'])
})
