import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function runActiveReportJourney(context) {
    const { page, server, fixture, viewport, iframe } = context
    await page.evaluate(() => {
        window.deliver({ type: 'console', source: 'target', level: 'log', text: 'Target startup welcome', url: 'https://example.com/', line: 135 })
        for (let i = 0; i < 30; i++) window.deliver({ type: 'console', source: 'provider', name: 'VirusTotal', level: 'warning', text: `Provider warning ${i}` })
        for (let i = 0; i < 25; i++) window.deliver({ type: 'console', source: 'target', level: 'info', text: `Target message ${i}` })
        window.deliver({ type: 'pageerror', source: 'target', message: 'Target error' })
    })
    await page.evaluate(() => {
        window.deliver({ type: 'tool_capture', id: 'virustotal', name: 'VirusTotal', url: 'https://www.virustotal.com/', toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 0, vendorTotal: 90 } })
        window.deliver({ type: 'tool_capture', id: 'webcrack', name: 'WebCrack', url: 'https://webcrack.netlify.app/', toolAnalysis: { toolKind: 'webcrack', webcrackLoaded: false, webcrackLoadReason: 'no obfuscated code found on target page' } })
    })
    assert.equal(await page.getByRole('tab', { name: /^WebCrack/ }).count(), 0, 'No-code WebCrack must be hidden')
    assert.equal(await page.locator('summary').filter({ hasText: /^Statistics/ }).innerText(), 'Statistics')
    assert.equal((await page.locator('summary').filter({ hasText: /^Console logs/ }).innerText()).replace(/\s+/g, ' '), 'Console logs 27')
    assert.equal(await page.locator('summary').filter({ hasText: /^Indicators/ }).count(), 0)
    const debug = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Debug$/ }) })
    await debug.locator('summary').click()
    assert((await debug.innerText()).includes('0 Indicators'))
    assert(!(await debug.innerText()).includes('Provider warning'))
    assert((await debug.innerText()).includes('Target startup welcome'))
    const rawDebug = await debug.locator('pre').textContent()
    await debug.getByRole('button', { name: 'Pretty', exact: true }).click()
    assert.equal(await debug.locator('tbody tr').count(), 27)
    assert.deepEqual(await debug.locator('tbody tr').last().locator('td').allTextContents(), ['error', 'Target error'])
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Pretty logs fit mobile')
    await debug.getByRole('button', { name: 'Raw', exact: true }).click()
    assert.equal(await debug.locator('pre').textContent(), rawDebug)
    await page.evaluate(() => window.deliver({ type: 'tool_capture', id: 'virustotal', name: 'VirusTotal', toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 1, vendorTotal: 90 } }))
    await page.getByLabel('1 suspicious indicators', { exact: true }).waitFor()
    assert((await page.getByLabel('1 suspicious indicators', { exact: true }).getAttribute('class')).includes('text-ui-warning'))
    await page.evaluate(() => window.deliver({ type: 'tool_capture', id: 'virustotal', name: 'VirusTotal', toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 10, vendorTotal: 90 } }))
    await page.getByLabel('1 indicators with 10 or more VirusTotal detections', { exact: true }).waitFor()
    assert((await page.getByLabel('1 indicators with 10 or more VirusTotal detections', { exact: true }).getAttribute('class')).includes('text-ui-danger'))
    await page.evaluate(() => window.deliver({ type: 'tool_capture', id: 'virustotal', name: 'VirusTotal', toolAnalysis: { toolKind: 'virustotal', vendorFlagged: 0, vendorTotal: 90 } }))

    const vtTab = page.getByRole('tab', { name: /^VirusTotal/ })
    assert(await vtTab.locator('img').isVisible(), 'Mobile provider tab shows its logo')
    assert((await vtTab.getByText('VirusTotal', { exact: true }).getAttribute('class')).includes('sr-only'), 'Provider name remains accessible without taking visible space')
    await page.evaluate(() => window.deliver({ type: 'tool_capture', id: 'webcrack', name: 'WebCrack', deobfuscatedCode: 'console.log("saved decoded");', toolAnalysis: { toolKind: 'webcrack', webcrackLoaded: true }, webcrackLoad: { loaded: true, sampleBytes: 30 } }))
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await page.getByRole('alert').getByText('Could not save the report. Try again.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await page.getByRole('region', { name: 'Share report' }).waitFor()
    assert.equal(await page.getByLabel('Report link', { exact: true }).inputValue(), new URL('/saved', server.url).toString())
    assert.equal(await page.getByRole('button', { name: 'Copied', exact: true }).count(), 0, 'Denied clipboard must not claim Copied')
    await page.evaluate(() => window.deliver({ type: 'ended' }))
    const result = page.locator('[data-run-result] > button')
    await result.waitFor()
    await page.getByRole('button', { name: '1 check without a verdict', exact: true }).click()
    assert((await page.locator('#checks-without-verdict').innerText()).includes('urlquery'))
    assert(!(await page.locator('#checks-without-verdict').innerText()).includes('VirusTotal'))
    assert.equal(await result.getAttribute('aria-expanded'), 'false', 'Completed runs become a closed result box')
    assert.equal(await viewport.isVisible(), false, 'Saved screenshots must not dominate a completed run')
    assert.equal(await iframe.count(), 0, 'Completion removes the live input surface')
    await result.click()
    assert.equal(await result.getAttribute('aria-expanded'), 'true')
    const consolePanel = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Console logs/ }) }).last()
    await consolePanel.locator('summary').click()
    assert((await consolePanel.innerText()).includes('[log] Target startup welcome (https://example.com/:135)'))
    assert((await consolePanel.innerText()).includes('Target message 24'), 'All retained target messages are visible, not only ten')
    assert(!(await consolePanel.innerText()).includes('Provider warning'), 'Provider warnings never displace the target console')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const report = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'))
    assert.equal(report.analystSummary.reviewQueue, undefined)
    assert.equal(report.analystReport.reviewQueue, undefined)
    assert.deepEqual(report.analystReport.recommendedActions, [])
    assert(!report.analystReport.markdown.includes('## Recommended actions'))
    assert(!report.analystReport.markdown.includes('## Analyst review'))
    assert(report.analystReport.markdown.includes('## URLs'))
    assert.equal(report.consoleEvents.length, 27)
    assert.equal(report.providerConsoleEvents.length, 30)
    assert(report.consoleEvents[0].includes('Target startup welcome'))
    const multilineLog = '[VirusTotal] [info] CSP report-only warning\nSecond line (https://example.com/script.js:5)'
    const unstructuredLog = 'Legacy message without prefixes\nStill preserved'
    let savedReport = { ...report, consoleEvents: [...report.consoleEvents, multilineLog.replace('[VirusTotal] ', ''), unstructuredLog] }
    savedReport.analystReport.networkEvidence = { requests: 2, recentRequests: [
        { url: 'https://example.com/', method: 'GET' },
        { url: 'https://example.com/', method: 'GET', status: 200, ip: '93.184.215.14', tlsIssuer: 'Test issuer', tlsSubject: 'example.com', tlsValidTo: 1900000000 },
        { url: 'https://example.com/blocked.js', failure: 'Blocked' },
    ] }
    savedReport.analystReport.resourceUrls = ['https://example.com/', 'https://example.com/unvisited']
    fixture.setSavedReport(savedReport)
    Object.assign(context, { report, result, multilineLog, unstructuredLog })
}
