// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { emptyUvmDashboard } from '../src/app/dashboard/scanner/scannerClient'
import { scannerSuiteCatalog } from '../src/app/dashboard/scanner/scannerSuiteCatalog'
import { UvmPanelScannerSetup } from '../src/app/dashboard/scanner/uvmPanelScannerSetup'

test('paused Scanner lists at least 20 products and labels setup state', () => {
    const noop = () => undefined
    const html = renderToStaticMarkup(<UvmPanelScannerSetup data={emptyUvmDashboard} busy='' region='us'
        setRegion={noop} accessKey='' setAccessKey={noop} secretKey='' setSecretKey={noop}
        servicesPaused onSave={noop} onDisconnect={noop}
    />)

    expect(scannerSuiteCatalog.length).toBeGreaterThanOrEqual(20)
    expect(html).toContain(`Scanner suite · ${scannerSuiteCatalog.length}`)
    expect(html).toContain('Nmap')
    expect(html).toContain('Angry IP Scanner')
    expect(html).toContain('Advanced IP Scanner')
    expect(html).toContain('Stopped · disk expansion')
    expect(html).toContain('Adapter setup needed')
})
