import { expect, test } from '@playwright/test'
import { fulfillAiReply } from './fulfillAiReply'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { pendingCheckpointStories, pendingSummaryStories } from './fixtures/changeReview'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI treats unapplied edits as a checkpoint before another run', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-pending-checkpoint-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = pendingCheckpointStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-pending-checkpoint-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Pending work must be resolved before the next run.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Pending checkpoint protects this draft.</p></main> }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of pendingCheckpointStories) {
        const expectedUrl = `https://hanasand.com/s/app-pending-checkpoint-${story.id}-${runSlug}`
        await page.goto(`/s/app-pending-checkpoint-${story.id}-${runSlug}?new=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Pending work must be resolved before the next run.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Review', { exact: true })).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Resolve the pending change before starting another AI run.')).toBeVisible()
        await expect(page.getByText('Apply or discard the pending change before asking for another edit.')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible()

        await promptBox.fill('actually do something else')
        await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
        await page.getByRole('button', { name: 'Discard' }).click()
        await expect(page.getByText('1 pending change')).not.toBeVisible()
        await expect(page.getByText('Resolve the pending change before starting another AI run.')).not.toBeVisible()
        await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(pendingCheckpointStories.length)
})
test('share page AI shows compact pending change summaries before raw diffs', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-pending-summary-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = pendingSummaryStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-pending-summary-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Change summary should be visible before the raw diff.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: [
                        'export default function Page() {',
                        `  return <main><h1>${matchingStory!.expected}</h1><p>Compact change summary before code.</p></main>`,
                        '}',
                    ].join('\n'),
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of pendingSummaryStories) {
        const expectedUrl = `https://hanasand.com/s/app-pending-summary-${story.id}-${runSlug}`
        await page.goto(`/s/app-pending-summary-${story.id}-${runSlug}?new=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Change summary should be visible before the raw diff.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('3 lines')).toBeVisible()
        await expect(page.getByText('+3')).toBeVisible()
        await expect(page.getByText('-0')).toBeVisible()
        await expect(page.getByText('New file', { exact: true })).toBeVisible()
        await expect(page.getByText('+ export default function Page() {')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
        await page.getByRole('button', { name: 'Discard' }).click()
    }

    expect(handledPrompts).toHaveLength(pendingSummaryStories.length)
})
