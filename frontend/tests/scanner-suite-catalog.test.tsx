// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyUvmDashboard } from '../src/app/dashboard/scanner/scannerClient'
import { getScannerSuiteCatalog, scannerSuiteCatalog } from '../src/app/dashboard/scanner/scannerSuiteCatalog'
import { UvmAssessmentEngineChoices } from '../src/app/dashboard/scanner/uvmPanelAssessmentControls'
import { UvmPanelScannerSetup } from '../src/app/dashboard/scanner/uvmPanelScannerSetup'
import ScannerPauseNotice from '../src/app/dashboard/scanner/scannerPauseNotice'

test('scanner page states that configured services are stopped pending disk expansion', () => {
    const html = renderToStaticMarkup(<ScannerPauseNotice paused reason='pending_disk_expansion' />)

    expect(html).toContain('Scanner services paused pending disk expansion.')
    expect(html).toContain('Scanner API, database, Nmap/Naabu, Angry IP Scanner, Greenbone, ZAP runner/proxy, testssl.sh, Nuclei, Nikto, SSLyze, Wapiti, WhatWeb, HTTPX, tlsx, Katana, WAFW00F, and image worker are stopped pending disk expansion.')
})

test('paused Scanner exposes the searchable 50-product catalog and labels setup state', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(<UvmPanelScannerSetup data={emptyUvmDashboard} busy='' region='us'
        setRegion={noop} accessKey='' setAccessKey={noop} secretKey='' setSecretKey={noop}
        servicesPaused onSave={noop} onDisconnect={noop}
    />)

    expect(scannerSuiteCatalog).toHaveLength(50)
    expect(new Set(scannerSuiteCatalog.map(item => item.name)).size).toBe(scannerSuiteCatalog.length)
    expect(scannerSuiteCatalog.filter(item => item.setup === 'configured')).toHaveLength(21)
    expect(html).toContain('50 products · 16 asset engines · 5 image tools · 0 running')
    expect(html).toContain('Filter scanners')
    expect(html).toContain('Nmap')
    expect(html).toContain('Naabu')
    expect(html).toContain('Stopped')
    expect(html).toContain('Stopped · pending disk')
    expect(html).not.toContain('Scanner services paused pending disk expansion.')
    expect(html).toContain('testssl.sh')
    expect(html).toContain('Angry IP Scanner')
    expect(html).toContain('Advanced IP Scanner')
    expect(html).toContain('Prowler')
    expect(html).toContain('Kubescape')
    expect(html).toContain('Snyk')
    expect(html).toContain('Adapter needed')
    expect(html).toContain('License + adapter needed')
    expect(html).not.toContain('GUI bridge needed')
    expect(html).toContain('Windows app · no API')
})

test('configured Angry IP is offered as an assessment engine', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(<UvmAssessmentEngineChoices data={emptyUvmDashboard} selectedEngines={[]}
        setSelectedEngines={noop} scanId='' setScanId={noop} nmapProfile='tcp-top-1000' setNmapProfile={noop}
        servicesPaused onSetup={noop}
    />)

    expect(html).toContain('Angry IP Scanner')
    expect(html).not.toContain('GUI bridge needed')
    expect(html).not.toContain('CLI review needed')
})

test('partial older API catalogs do not hide products or downgrade staged setup metadata', () => {
    const olderCatalog = [{
        id: 'nuclei',
        name: 'Nuclei',
        category: 'Web' as const,
        integration: 'catalog-only' as const,
        setup: 'adapter-needed' as const,
    }]
    const catalog = getScannerSuiteCatalog(olderCatalog)

    expect(catalog).toHaveLength(scannerSuiteCatalog.length)
    expect(catalog.find(item => item.id === 'nuclei')?.integration).toBe('nuclei')
    expect(catalog.find(item => item.id === 'nuclei')?.setup).toBe('configured')
    expect(catalog.some(item => item.id === 'nmap')).toBe(true)
})
