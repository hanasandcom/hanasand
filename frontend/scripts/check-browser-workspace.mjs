import assert from 'node:assert/strict'
import { createBrowserWorkspaceFixture } from './browserWorkspace/fixture.mjs'
import { installBrowserTestSetup } from './browserWorkspace/browserTestSetup.mjs'
import { runStartupJourney } from './browserWorkspace/startupJourney.mjs'
import { runLiveWorkspaceJourney } from './browserWorkspace/liveWorkspaceJourney.mjs'
import { runActiveReportJourney } from './browserWorkspace/activeReportJourney.mjs'
import { runSavedReportJourney } from './browserWorkspace/savedReportJourney.mjs'
import { runRunLifecycleJourney } from './browserWorkspace/runLifecycleJourney.mjs'
import { runHistoryJourney } from './browserWorkspace/historyJourney.mjs'

const fixture = await createBrowserWorkspaceFixture()
try {
    const page = await fixture.browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await installBrowserTestSetup(page)
    await page.goto(fixture.server.url.toString())
    const context = { page, browser: fixture.browser, server: fixture.server, fixture }
    await runStartupJourney(context)
    await runLiveWorkspaceJourney(context)
    await runActiveReportJourney(context)
    await runSavedReportJourney(context)
    await runRunLifecycleJourney(context)
    await runHistoryJourney(context)
    assert.deepEqual(errors, [])
    console.log('Browser workspace passed: loading until first frame, stream readiness, cancellation, launch errors, live input, stable stream, downloads, completion box and mobile width.')
} finally {
    await fixture.close()
}
