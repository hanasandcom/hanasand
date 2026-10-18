import { expect, test } from '@playwright/test'
import { fulfillAiReply } from './fulfillAiReply'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { contextBudgetStories, speedReviewStories, toolFrictionStories } from './fixtures/core'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share chat reaches concise two-file review quickly for speed-review stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-speed-review-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = speedReviewStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Done: ${matchingStory!.expected}. Review the two files before applying.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Useful, careful, and scoped. No fake portals, guarantees, uploads, or payments.</p></main> }`,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/brief.tsx',
                    content: `export const brief = { topic: '${matchingStory!.expected}', review: 'Manual apply only', scope: 'Two small files' }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of speedReviewStories) {
        await page.goto(`/s/app-speed-review-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Done: ${story.expected}. Review the two files before applying.`)).toBeVisible({ timeout: 3000 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('2 file changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/brief.tsx')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(3000)
    }

    expect(handledPrompts).toHaveLength(speedReviewStories.length)
})
test('share chat avoids bloat and exposes review controls for tool-friction stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-tool-friction-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = toolFrictionStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2600)
        expect(body.prompt).toContain('Keep visible prose to at most 5 short sentences')
        expect(body.context?.length || 0).toBeLessThan(12_000)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Two scoped files are waiting for review.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Clear next step, careful claims, and no fake backend promises.</p></main> }`,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/review-notes.ts',
                    content: 'export const reviewNotes = [\'Manual review before apply\', \'No fake payments, portals, uploads, guarantees, or hidden background work\']',
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of toolFrictionStories) {
        await page.goto(`/s/app-tool-friction-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Two scoped files are waiting for review.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('2 file changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/review-notes.ts')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        await expect(page.getByText('No fake payments, portals, uploads, guarantees, or hidden background work')).toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(toolFrictionStories.length)
})
test('share chat keeps context lean while resolving context-budget stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-context-budget-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = contextBudgetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.context?.length || 0).toBeLessThan(9_000)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Review the files, then apply.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Plain next step, careful scope, and no invented system behind it.</p></main> }`,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/decision.ts',
                    content: `export const decision = { changed: '${matchingStory!.expected}', mode: 'lean context', apply: 'manual' }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of contextBudgetStories) {
        await page.goto(`/s/app-context-budget-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Review the files, then apply.`)).toBeVisible({ timeout: 2200 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/decision.ts')).toBeVisible()
        await expect(page.getByText('lean context')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2200)
    }

    expect(handledPrompts).toHaveLength(contextBudgetStories.length)
})
