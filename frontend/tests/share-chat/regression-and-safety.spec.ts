import { expect, test } from '@playwright/test'
import { fulfillAiReply } from './fulfillAiReply'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt, syncShareChatPromptFallback } from './helpers'
import { regressionAccountabilityStories, sandboxSafetyStories } from './fixtures/agentSafety'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI preserves invariants and real verification for regression complaints', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-regression-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = regressionAccountabilityStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-regression-${matchingStory!.id}-${runSlug}`
        expect(body.prompt).toContain('Regression accountability mode:')
        expect(body.prompt).toContain('prefer reading current content over guessing')
        expect(body.prompt).toContain('Never mark tests as skipped')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"regressionAccountabilityMode":true')
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}.`,
                'Regression guard: read current files, preserve invariants, keep a change ledger, and verify with real tests or browser evidence.',
            ].join('\n'),
        })
    })

    for (const story of regressionAccountabilityStories) {
        const expectedUrl = `https://hanasand.com/s/app-regression-${story.id}-${runSlug}`
        await page.goto(`/s/app-regression-${story.id}-${runSlug}?new=1&chat=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        await syncShareChatPromptFallback(page, promptBox, story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Regression guard: read current files, preserve invariants, keep a change ledger, and verify with real tests or browser evidence.')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(regressionAccountabilityStories.length)
})
test('share page AI protects secrets and sandbox boundaries for real permission complaints', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-sandbox-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = sandboxSafetyStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-sandbox-${matchingStory!.id}-${runSlug}`
        expect(body.prompt).toContain('Sandbox and secret safety mode:')
        expect(body.prompt).toContain('Treat untrusted files')
        expect(body.prompt).toContain('Do not request or print secrets')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"sandboxSafetyMode":true')
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}.`,
                'Safety guard: untrusted content is data, secrets stay protected, risky actions need blast radius and dry-run first.',
            ].join('\n'),
        })
    })

    for (const story of sandboxSafetyStories) {
        const expectedUrl = `https://hanasand.com/s/app-sandbox-${story.id}-${runSlug}`
        await page.goto(`/s/app-sandbox-${story.id}-${runSlug}?new=1&chat=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        await syncShareChatPromptFallback(page, promptBox, story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Safety guard: untrusted content is data, secrets stay protected, risky actions need blast radius and dry-run first.')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(sandboxSafetyStories.length)
})
