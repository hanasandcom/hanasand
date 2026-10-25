// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyUvmDashboard } from '../src/app/dashboard/scanner/scannerClient'
import { getScannerSuiteCatalog, scannerSuiteCatalog } from '../src/app/dashboard/scanner/scannerSuiteCatalog'
import { UvmAssessmentEngineChoices } from '../src/app/dashboard/scanner/uvmPanelAssessmentControls'
import { getScannerSuiteCategory, UvmPanelScannerSetup } from '../src/app/dashboard/scanner/uvmPanelScannerSetup'
import ScannerPauseNotice from '../src/app/dashboard/scanner/scannerPauseNotice'

test('scanner page states that configured services are stopped pending disk expansion', () => {
    const html = renderToStaticMarkup(<ScannerPauseNotice paused reason='pending_disk_expansion' />)

    expect(html).toContain('Scanner services paused pending disk expansion.')
    expect(html).toContain('Scanner API, database, Nmap/Naabu, Angry IP Scanner, Greenbone, ZAP runner/proxy, testssl.sh, Nuclei, Nikto, SSLyze, Wapiti, WhatWeb, HTTPX, tlsx, Katana, WAFW00F, and image worker are stopped pending disk expansion.')
})

test('paused Scanner shows one searchable catalog category at a time', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(<UvmPanelScannerSetup data={emptyUvmDashboard} busy='' region='us'
        setRegion={noop} accessKey='' setAccessKey={noop} secretKey='' setSecretKey={noop}
        servicesPaused onSave={noop} onDisconnect={noop}
    />)
    const panelStart = html.indexOf('role="tabpanel"')
    const catalogHtml = html.slice(panelStart, html.indexOf('</section>', panelStart))

    expect(scannerSuiteCatalog).toHaveLength(126)
    expect(new Set(scannerSuiteCatalog.map(item => item.name)).size).toBe(scannerSuiteCatalog.length)
    expect(scannerSuiteCatalog.filter(item => item.setup === 'configured')).toHaveLength(23)
    expect(html).toContain('126 products · 17 asset engines · 5 image tools · 0 running')
    expect(html).toContain('Scanner categories')
    expect(html).toContain('role="tab" id="scanner-suite-category-panel-tab-web" aria-selected="true"')
    expect(html).toContain('role="tab" id="scanner-suite-category-panel-tab-discovery" aria-selected="false"')
    expect(html).toContain('role="tab" id="scanner-suite-category-panel-tab-cloud" aria-selected="false"')
    expect(html).toContain('role="tabpanel" id="scanner-suite-category-panel"')
    expect(html).not.toContain('Other catalog products')
    expect(html).not.toContain('Integrated tools')
    expect(html).toContain('Filter scanners')
    expect(html).toContain('OWASP ZAP')
    expect(catalogHtml).not.toContain('Nmap')
    expect(catalogHtml).not.toContain('Tenable Vulnerability Management')
    expect(html).not.toContain('Configure</button>')
    expect(html).toContain('Stopped')
    expect(html).not.toContain('pending disk')
    expect(html).not.toContain('Scanner services paused pending disk expansion.')
    expect(getScannerSuiteCategory(scannerSuiteCatalog.find(item => item.integration === 'tenable-vm')!)).toBe('discovery')
    expect(getScannerSuiteCategory(scannerSuiteCatalog.find(item => item.category === 'Cloud and code')!)).toBe('cloud')
    expect(scannerSuiteCatalog.filter(item => getScannerSuiteCategory(item) === 'web')).toHaveLength(29)
    expect(scannerSuiteCatalog.filter(item => getScannerSuiteCategory(item) === 'discovery')).toHaveLength(48)
    expect(scannerSuiteCatalog.filter(item => getScannerSuiteCategory(item) === 'cloud')).toHaveLength(49)
    for (const id of [
        'bloodhound', 'sharphound', 'sqlmap', 'metasploit-framework', 'hashcat', 'john-the-ripper',
        'impacket', 'responder', 'crackmapexec', 'netexec', 'ffuf', 'commix', 'wfuzz', 'dirsearch',
        'mimikatz', 'rubeus', 'certipy', 'powersploit', 'powerup', 'cewl', 'medusa', 'aircrack-ng', 'wifite2',
        'schemathesis', 'burp-suite-professional', 'codeql', 'garak', 'aflplusplus',
        'restler', 'apiclarity', '42crunch-api-security', 'dependency-track', 'sonarqube',
        'openssf-scorecard', 'pip-audit', 'cargo-audit', 'kube-linter', 'cloudsplaining',
        'jazzer', 'jazzer-js', 'aflnet', 'binwalk', 'falco', 'tetragon', 'honggfuzz',
        'boofuzz', 'quark-engine', 'apkid', 'pmapper',
    ]) {
        expect(scannerSuiteCatalog.some(item => item.id === id)).toBe(true)
    }
})

test('Retire.js is listed as a ZAP add-on, not a separate asset engine', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(<UvmPanelScannerSetup data={emptyUvmDashboard} busy='' region='us'
        setRegion={noop} accessKey='' setAccessKey={noop} secretKey='' setSecretKey={noop}
        servicesPaused={false} onSave={noop} onDisconnect={noop}
    />)

    expect(html).toContain('Retire.js')
    expect(html).toContain('Included in ZAP')
    expect(scannerSuiteCatalog.filter(item => item.integration === 'zap-addon')).toHaveLength(1)
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
    expect(html).toContain('Stopped')
    expect(html).not.toContain('pending disk')
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
