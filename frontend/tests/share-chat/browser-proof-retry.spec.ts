import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { proofGateStories, proofRecoveryStories } from './fixtures/browserOutcomes'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI blocks applying pending edits when browser proof needs retry', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-proof-gate-story' })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-proof-gate-')
        await route.fulfill({
            status: 504,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Browser proof gateway timeout.' }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = proofGateStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-proof-gate-${matchingStory!.id}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Apply must stay blocked until browser proof succeeds.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Apply stays blocked while proof needs retry.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of proofGateStories) {
        const expectedUrl = `https://hanasand.com/s/app-proof-gate-${story.id}`
        await page.goto(`/s/app-proof-gate-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Apply must stay blocked until browser proof succeeds.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).toBeVisible()
        await expect(page.getByText('Browser proof needs retry before these changes can be applied.')).toBeVisible()
        const applyButton = page.getByRole('button', { name: 'Retry proof first' })
        await expect(applyButton).toBeVisible()
        await expect(applyButton).toBeDisabled()
        await expect(page.getByText('Apply', { exact: true })).not.toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('1 issues')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(proofGateStories.length)
})
test('share page AI lets users retry failed browser proof without rerunning the prompt', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-proof-recovery-story' })

    const proofAttempts = new Map<string, number>()
    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-proof-recovery-')
        const url = body.url || ''
        const attempts = proofAttempts.get(url) || 0
        proofAttempts.set(url, attempts + 1)

        if (attempts === 0) {
            await route.fulfill({
                status: 504,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Browser proof gateway timeout.' }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url,
                title: 'Recovered preview',
                screenshotPath: `/browser-proof/${url.split('-').pop()}.png`,
                structure: {
                    headings: ['Recovered proof'],
                    links: [{ text: 'Open page', href: url }],
                    buttons: ['Apply'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                consoleMessages: [],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = proofRecoveryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-proof-recovery-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Retry proof should recover without rerunning the prompt.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Retry proof unlocks apply after browser evidence succeeds.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of proofRecoveryStories) {
        const expectedUrl = `https://hanasand.com/s/app-proof-recovery-${story.id}-${runSlug}`
        await page.goto(`/s/app-proof-recovery-${story.id}-${runSlug}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Retry proof should recover without rerunning the prompt.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).toBeVisible()
        await expect(page.getByText('Browser proof needs retry before these changes can be applied.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Retry proof first' })).toBeDisabled()
        const retryButton = page.getByRole('button', { name: 'Retry proof', exact: true })
        await expect(retryButton).toBeVisible()
        await retryButton.click()

        await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Needs retry', { exact: true })).not.toBeVisible()
        await expect(page.getByText('Browser proof needs retry before these changes can be applied.')).not.toBeVisible()
        await expect(page.getByText('Browser proof: Recovered preview')).toBeVisible()
        await expect(page.getByText('0 issues')).toBeVisible()
        await expect(page.getByText('Screenshot captured')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(3200)
        expect(proofAttempts.get(expectedUrl)).toBe(2)
    }

    expect(handledPrompts).toHaveLength(proofRecoveryStories.length)
})
