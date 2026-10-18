import { expect, test } from '@playwright/test'
import { fulfillAiReply } from './fulfillAiReply'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { browserRetryStories, runSummaryStories } from './fixtures/browserOutcomes'
import { browserTaskResult } from './fixtures/browserTaskResult'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI shows a bounded last-run receipt for ambiguous user requests', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-run-summary-story' })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-run-summary-')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(browserTaskResult({
                url: body.url,
                title: 'Run Summary Proof',
                textExcerpt: 'The last-run receipt shows duration, edit count, browser proof count, and token cap.',
                headings: ['Run summary proof', 'Bounded progress'],
                links: [{ text: 'Checked page', href: body.url }],
                buttons: ['Review'],
                screenshotPath: null,
            })),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = runSummaryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-run-summary-${matchingStory!.id}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Keep visible prose to at most 5 short sentences')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Run receipt is visible without terminal logs.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'browser_task',
                    url: expectedUrl,
                    captureScreenshot: true,
                    timeoutMs: 16000,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Bounded last run, browser proof, and manual apply.</p></main> }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of runSummaryStories) {
        const expectedUrl = `https://hanasand.com/s/app-run-summary-${story.id}`
        await page.goto(`/s/app-run-summary-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Run receipt is visible without terminal logs.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Last run', { exact: true })).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('1 edit')).toBeVisible()
        await expect(page.getByText('1 browser proof')).toBeVisible()
        await expect(page.getByText('2.2k cap')).toBeVisible()
        await expect(page.getByText('Completed', { exact: true })).toBeVisible()
        await expect(page.getByText('Browser proof: Run Summary Proof')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(runSummaryStories.length)
})
test('share page AI marks the last run as needing retry when browser proof fails', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-browser-retry-story' })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-browser-retry-')
        await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Browser evidence timed out.' }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = browserRetryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-browser-retry-${matchingStory!.id}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Use browser evidence before claiming a page works')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Browser proof must show retry if it fails.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'browser_task',
                    url: expectedUrl,
                    captureScreenshot: true,
                    timeoutMs: 16000,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Do not claim browser proof succeeded when it failed.</p></main> }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of browserRetryStories) {
        const expectedUrl = `https://hanasand.com/s/app-browser-retry-${story.id}`
        await page.goto(`/s/app-browser-retry-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Browser proof must show retry if it fails.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Last run', { exact: true })).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).toBeVisible()
        await expect(page.getByText('Completed', { exact: true })).not.toBeVisible()
        await expect(page.getByText('1 edit')).toBeVisible()
        await expect(page.getByText('1 browser proof')).toBeVisible()
        await expect(page.getByText('2.2k cap')).toBeVisible()
        await expect(page.getByText('Browser proof: Untitled page')).toBeVisible()
        await expect(page.getByText('1 issues')).toBeVisible()
        await expect(page.getByText('Page issues: 1.')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(browserRetryStories.length)
})
