import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { stories, transparencyStories } from './fixtures/core'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share chat surfaces progress, context, and review gates for ambiguous app stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-ui-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = stories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Prepared a focused ${matchingStory!.expected} page with narrow scope and reviewable changes.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>No fake portals, payments, or sensitive data collection.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of stories) {
        await page.goto(`/s/app-ui-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('No auto-apply')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(/Prepared a focused/)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('No fake portals, payments, or sensitive data collection.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(stories.length)
})
test('share chat keeps the mobile chat viewport unobscured by the explorer rail', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await page.setViewportSize({ width: 520, height: 820 })

    await mockShareApi(page, { fallbackId: 'app-mobile-chat-story' })

    await page.goto('/s/app-mobile-chat-861?new=1')
    await expect(page.getByRole('button', { name: 'Open file explorer' })).toHaveCount(1)
    await openWorkspaceBuildPrompt(page)

    await expect(page.getByText('Chat workspace')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open file explorer' })).toHaveCount(0)
    await expect(page.getByPlaceholder('Describe what you want to build or change...')).toBeVisible()
    await expect(page.getByText('No auto-apply')).toBeVisible()
})
test('share chat makes no-auto-apply and pending-file state explicit for transparency stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-transparency-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = transparencyStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Prepared ${matchingStory!.expected} changes for manual review.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Manual review required before apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of transparencyStories) {
        await page.goto(`/s/app-transparency-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('No auto-apply')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Prepared ${story.expected} changes for manual review.`)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('Manual review required before apply.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(transparencyStories.length)
})
