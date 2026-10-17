import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { evidenceSummaryStories, visibleProofTargetStories } from './fixtures/browserTargets'
import { browserTaskResult } from './fixtures/browserTaskResult'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI shows the browser proof target before users send ambiguous prompts', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-visible-proof-target-story' })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-visible-target-')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(browserTaskResult({
                url: body.url,
                title: 'Visible Target Evidence',
                textExcerpt: 'The proof target is visible before the user sends.',
                headings: ['Visible proof target', 'Trustworthy evidence'],
                links: [{ text: 'Current target', href: body.url }],
                buttons: ['Review'],
                screenshotPath: null,
            })),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string }
        const matchingStory = visibleProofTargetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-visible-target-${matchingStory!.id}`
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. The proof target was visible before the check.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Visible proof target, compact response, manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of visibleProofTargetStories) {
        const expectedUrl = `https://hanasand.com/s/app-visible-target-${story.id}`
        await page.goto(`/s/app-visible-target-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('Current share target')).toBeVisible()
        await expect(page.getByText(expectedUrl)).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. The proof target was visible before the check.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof visible for ${expectedUrl}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Visible proof target').last()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(visibleProofTargetStories.length)
})
test('share page AI summarizes browser evidence in the chat status strip for fast handoff', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-evidence-summary-story' })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        const storyId = Number(body.url?.match(/app-proof-strip-(\d+)/)?.[1] || 0)
        expect(storyId).toBeGreaterThanOrEqual(1081)
        const hasScreenshot = storyId % 2 === 0
        const hasIssue = storyId % 3 === 0
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(browserTaskResult({
                url: body.url,
                title: `Proof Strip ${storyId}`,
                textExcerpt: 'Compact proof strip with title, URL, issue count, and screenshot state.',
                headings: [`Proof strip ${storyId}`, 'Fast handoff'],
                links: [{ text: 'Open checked page', href: body.url }],
                buttons: ['Review proof'],
                screenshotPath: hasScreenshot ? `/screenshots/proof-strip-${storyId}.png` : null,
                pageErrors: hasIssue ? ['Visible issue found in proof strip test'] : [],
            })),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = evidenceSummaryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-proof-strip-${matchingStory!.id}`
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Proof summary is visible in the chat strip.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Fast proof summary, no terminal scrollback, manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of evidenceSummaryStories) {
        const expectedUrl = `https://hanasand.com/s/app-proof-strip-${story.id}`
        await page.goto(`/s/app-proof-strip-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Proof summary is visible in the chat strip.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof: Proof Strip ${story.id}`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('2 headings').first()).toBeVisible()
        await expect(page.getByText(`${story.id % 3 === 0 ? 1 : 0} issues`).first()).toBeVisible()
        await expect(page.getByText(story.id % 2 === 0 ? 'Screenshot captured' : 'No screenshot').first()).toBeVisible()
        await expect(page.getByText(`Browser proof visible for ${expectedUrl}.`)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(evidenceSummaryStories.length)
})
