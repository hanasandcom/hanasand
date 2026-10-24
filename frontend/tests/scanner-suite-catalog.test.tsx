// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyUvmDashboard } from '../src/app/dashboard/scanner/scannerClient'
import { getScannerSuiteCatalog, scannerSuiteCatalog } from '../src/app/dashboard/scanner/scannerSuiteCatalog'
import { UvmPanelScannerSetup } from '../src/app/dashboard/scanner/uvmPanelScannerSetup'
import ScannerPauseNotice from '../src/app/dashboard/scanner/scannerPauseNotice'

test('scanner page states that configured services are stopped pending disk expansion', () => {
    const html = renderToStaticMarkup(<ScannerPauseNotice />)

    expect(html).toContain('Scanner services are stopped pending disk expansion')
    expect(html).toContain('API, database, Nmap/Naabu, Greenbone, ZAP runner/proxy, testssl.sh, Nuclei, Nikto, SSLyze, Wapiti, WhatWeb, HTTPX, tlsx, Katana, and WAFW00F workers.')
    expect(html).toContain('Image worker is also stopped.')
})

test('paused Scanner lists at least 20 products and labels setup state', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(<UvmPanelScannerSetup data={emptyUvmDashboard} busy='' region='us'
        setRegion={noop} accessKey='' setAccessKey={noop} secretKey='' setSecretKey={noop}
        servicesPaused onSave={noop} onDisconnect={noop}
    />)

    expect(scannerSuiteCatalog.length).toBeGreaterThanOrEqual(20)
    expect(new Set(scannerSuiteCatalog.map(item => item.name)).size).toBe(scannerSuiteCatalog.length)
    expect(scannerSuiteCatalog.filter(item => item.setup === 'configured')).toHaveLength(20)
    expect(html).toContain('20 integrations wired · 0 running')
    expect(html).toContain('Nmap')
    expect(html).toContain('Naabu')
    expect(html).toContain('Stopped')
    expect(html).not.toContain('Stopped · pending disk')
    expect(html).not.toContain('Scanner services are stopped pending disk expansion')
    expect(html).toContain('testssl.sh')
    expect(html).toContain('Angry IP Scanner')
    expect(html).toContain('Advanced IP Scanner')
    expect(html).toContain('Adapter needed')
    expect(html).toContain('License + adapter needed')
    expect(html).toContain('Desktop app')
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
