import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { bannedCopy, colorSchemes, deadEndCopyPatterns, expectedRows, highContrastDarkTokens, localAuthFixture, pageSpecs, viewports } from './config.mjs'
import { cookieUrl, gotoWithRetry, pageUrl, parseArgs, resultSkeleton, screenshotPath } from './cli.mjs'
import { inspectRenderedPage } from './inspectPage.mjs'

export async function runDashboardRenderProof(argv = process.argv.slice(2)) {
    const options = parseArgs(argv)
    await mkdir(options.outDir, { recursive: true })
    const selectedPageSpecs = options.pageIds.length ? pageSpecs.filter(spec => options.pageIds.includes(spec.id)) : pageSpecs
    const unknownPageIds = options.pageIds.filter(pageId => !pageSpecs.some(spec => spec.id === pageId))
    assert.equal(unknownPageIds.length, 0, `Unknown page ids: ${unknownPageIds.join(', ')}`)
    const artifact = createArtifact(options)
    let browser
    try {
        browser = await chromium.launch({ headless: true })
        for (const spec of selectedPageSpecs) {
            for (const colorScheme of colorSchemes) {
                for (const viewport of viewports) {
                    const result = await renderPage(browser, options, spec, viewport, colorScheme, artifact)
                    artifact.pages.push(result)
                }
            }
        }
    } catch (error) {
        artifact.summary.failureReasons.push(error instanceof Error ? error.message : String(error))
    } finally {
        await browser?.close()
    }
    summarizePages(artifact)
    await writeFile(options.jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(artifact, null, 2))
    assert.equal(artifact.summary.passed, true, `Dashboard render proof failed; see ${options.jsonPath}`)
}

function createArtifact(options) {
    return {
        schema: 'hanasand.dashboard.render-proof.v1', generatedAt: new Date().toISOString(), baseUrl: options.baseUrl,
        expectedRows, pages: [], summary: { passed: false, artifactPath: options.jsonPath, screenshotPaths: [], failureReasons: [], selectorCounts: {}, overlapCount: 0, bannedCopyList: [] },
    }
}

async function renderPage(browser, options, spec, viewport, colorScheme, artifact) {
    console.error(`[render-proof] ${spec.id} ${colorScheme} ${viewport.name}`)
    const imagePath = screenshotPath(options.outDir, spec.id, viewport.name, colorScheme)
    const result = resultSkeleton(spec, viewport, colorScheme, imagePath)
    artifact.summary.screenshotPaths.push(imagePath)
    const context = await browser.newContext({ viewport, colorScheme, extraHTTPHeaders: { 'x-hanasand-render-proof-auth': localAuthFixture.header } })
    await addFixtureCookies(context, options.baseUrl, colorScheme)
    await context.addInitScript((scheme) => {
        document.documentElement.classList.toggle('dark', scheme === 'dark')
        document.documentElement.classList.toggle('light', scheme === 'light')
        window.localStorage.setItem('theme', scheme)
    }, colorScheme)
    const page = await context.newPage()
    const consoleWarnings = collectConsoleWarnings(page)
    try {
        await gotoWithRetry(page, pageUrl(options.baseUrl, spec.path), { waitUntil: 'domcontentloaded', timeout: 45000 })
        await waitForSelectors(page, spec.requiredSelectors)
        await page.waitForTimeout(250)
        await page.screenshot({ path: imagePath, fullPage: true })
        Object.assign(result, await inspectRenderedPage(page, spec, { bannedCopy, expectedRows, highContrastDarkTokens, deadEndCopyPatterns }))
        result.consoleWarnings = consoleWarnings
        for (const warning of consoleWarnings) result.reasons.push(`console warning: ${warning}`)
        result.passed = result.reasons.length === 0
    } catch (error) {
        result.reasons.push(error instanceof Error ? error.message : String(error))
    } finally {
        await context.close()
    }
    return result
}

async function addFixtureCookies(context, baseUrl, colorScheme) {
    const values = [
        { name: 'id', value: localAuthFixture.id }, { name: 'name', value: localAuthFixture.name },
        { name: 'access_token', value: localAuthFixture.token },
        { name: 'email', value: 'dashboard-render-proof@hanasand.local' }, { name: 'theme', value: colorScheme },
    ]
    await context.addCookies(values.map(cookie => ({ ...cookie, value: encodeURIComponent(cookie.value), url: cookieUrl(baseUrl), httpOnly: false, secure: false, sameSite: 'Lax' })))
}

function collectConsoleWarnings(page) {
    const warnings = []
    page.on('console', message => {
        if (!['warning', 'error'].includes(message.type())) return
        const text = message.text()
        if (/same key|encountered two children/i.test(text)) warnings.push(text)
    })
    return warnings
}

async function waitForSelectors(page, selectors) {
    for (const selector of selectors) await page.locator(selector).first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {})
}

function summarizePages(artifact) {
    for (const pageResult of artifact.pages) {
        artifact.summary.overlapCount += pageResult.overlapCount
        artifact.summary.bannedCopyList.push(...pageResult.bannedCopyList)
        for (const [selector, count] of Object.entries(pageResult.selectorCounts)) {
            artifact.summary.selectorCounts[`${pageResult.pageId}:${pageResult.colorScheme}:${pageResult.viewport.name}:${selector}`] = count
        }
        for (const reason of pageResult.reasons) artifact.summary.failureReasons.push(`${pageResult.pageId}/${pageResult.colorScheme}/${pageResult.viewport.name}: ${reason}`)
    }
    artifact.summary.bannedCopyList = Array.from(new Set(artifact.summary.bannedCopyList))
    artifact.summary.passed = artifact.summary.failureReasons.length === 0
}
