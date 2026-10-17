import assert from 'node:assert/strict'

export async function runStartupJourney(context) {
    const { page, server } = context
    await page.goto(server.url.toString())
    for (const viewportSize of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewportSize)
        assert(await page.locator('[data-browser-landing]').evaluate(element => element.scrollHeight <= element.clientHeight), 'Landing fits without page scrolling')
        const history = page.getByRole('button', { name: 'History', exact: true })
        assert.equal(await history.evaluate(element => getComputedStyle(element).position), 'static')
        assert(await history.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), 'History remains inside viewport')
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Browser metadata' }).click()
    const width = page.getByLabel('Viewport width', { exact: true })
    const height = page.getByLabel('Viewport height', { exact: true })
    const locale = page.getByLabel('Locale', { exact: true })
    const timezone = page.getByLabel('Timezone', { exact: true })
    const platform = page.getByLabel('Platform', { exact: true })
    assert.equal(await width.getAttribute('inputmode'), 'numeric')
    assert.equal(await height.getAttribute('inputmode'), 'numeric')
    await width.fill('1280')
    await height.fill('720')
    await locale.fill('fr-FR')
    await timezone.fill('Europe/Oslo')
    await platform.fill('Linux x86_64')
    await page.getByPlaceholder('URL to investigate').fill('https://example.com')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForFunction(() => window.browserMessages.some(message => message.type === 'start'))
    const startMessage = await page.evaluate(() => window.browserMessages.find(message => message.type === 'start'))
    assert.deepEqual(
        [startMessage.width, startMessage.height, startMessage.locale, startMessage.timezoneId, startMessage.platform],
        [1280, 720, 'fr-FR', 'Europe/Oslo', 'Linux x86_64'],
        'Metadata controls must pass their edited values into the browser session request',
    )
    const viewport = page.locator('[data-browser-viewport]')
    const loading = page.locator('[data-browser-loading]')
    const workspace = page.locator('[data-browser-workspace]')
    await loading.waitFor()
    assert.equal(await page.getByRole('button', { name: 'History', exact: true }).count(), 0, 'History is hidden during a run')
    assert.equal(await loading.locator('[aria-current="step"]').innerText(), 'Connect')
    await page.evaluate(() => window.deliver({ type: 'status', state: 'launching_worker' }))
    await loading.getByText('Starting browser…', { exact: true }).waitFor()
    await page.evaluate(() => window.deliver({ type: 'status', state: 'navigating' }))
    await loading.getByText('Loading page…', { exact: true }).waitFor()
    await page.evaluate(() => window.deliver({ type: 'status', state: 'profile_tool_started' }))
    assert.equal(await loading.locator('[aria-current="step"]').innerText(), 'Load page', 'Unrelated status must not reset real progress')
    await page.waitForTimeout(1100)
    assert.notEqual(await loading.getByLabel('Elapsed time').innerText(), '0:00')
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Startup fits mobile')
    await page.setViewportSize({ width: 1440, height: 900 })
    assert.equal(await workspace.evaluate(element => getComputedStyle(element).opacity), '0')
    assert.equal(await workspace.getAttribute('inert'), '')
    assert.equal(await page.getByRole('tablist').count(), 0, 'Startup controls and evidence must not be exposed before the first frame')
    await page.evaluate(() => window.deliver({ type: 'ready', capacity: {activeSessions: 1, maxSessions: 100} }))
    assert(await loading.isVisible(), 'Broker readiness alone must not reveal the workspace')
    if (process.env.BROWSER_WORKSPACE_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_WORKSPACE_SCREENSHOT.replace('.png', '-loading.png') })
    const image = await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720
        const ctx = canvas.getContext('2d'); const pixels = ctx.createImageData(1280, 720)
        for (let i = 0; i < pixels.data.length; i += 4) { pixels.data[i] = i % 251; pixels.data[i + 1] = i % 191; pixels.data[i + 2] = i % 139; pixels.data[i + 3] = 255 }
        ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/jpeg').split(',')[1]
    })
    await page.evaluate(image => window.deliver({ type: 'frame', image, width: 1280, height: 720, url: 'https://example.com', reason: 'domcontentloaded', networkSummary: { requestCount: 91, uniqueDomainCount: 13, failedCount: 0 }, evidence: { reasons: ['No high-signal malicious pattern was extracted from the rendered page yet.'] } }), image)
    await page.getByAltText('Live browser sandbox frame').waitFor()
    await loading.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('tablist').count(), 1)
    Object.assign(context, { viewport, loading, image })
}
