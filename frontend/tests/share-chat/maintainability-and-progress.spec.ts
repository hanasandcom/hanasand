import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt, syncShareChatPromptFallback } from './helpers'
import { maintainabilityStories, progressGovernanceStories } from './fixtures/agentSafety'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI flags maintainability and ownership risks from real AI-builder complaints', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-maintainability-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = maintainabilityStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-maintainability-${matchingStory!.id}-${runSlug}`
        expect(body.prompt).toContain('Maintainability mode:')
        expect(body.prompt).toContain('owned code')
        expect(body.prompt).toContain('performance and ownership as acceptance criteria')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"maintainabilityMode":true')
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}.`,
                    'Maintainability guard: keep owned code, small dependencies, editable content, and no generated bloat.',
                ].join('\n'),
            }),
        })
    })

    for (const story of maintainabilityStories) {
        const expectedUrl = `https://hanasand.com/s/app-maintainability-${story.id}-${runSlug}`
        await page.goto(`/s/app-maintainability-${story.id}-${runSlug}?new=1&chat=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        await syncShareChatPromptFallback(page, promptBox, story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Maintainability guard: keep owned code, small dependencies, editable content, and no generated bloat.')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(maintainabilityStories.length)
})
test('share page AI makes progress, blockers, and approvals observable for real agent complaints', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-progress-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = progressGovernanceStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-progress-${matchingStory!.id}-${runSlug}`
        expect(body.prompt).toContain('Progress governance mode:')
        expect(body.prompt).toContain('Make approval points meaningful')
        expect(body.prompt).toContain('collect stdout/stderr')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"progressGovernanceMode":true')
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}.`,
                    'Progress guard: exact blocker, observable evidence, meaningful approval scope, and smallest reversible next step.',
                ].join('\n'),
            }),
        })
    })

    for (const story of progressGovernanceStories) {
        const expectedUrl = `https://hanasand.com/s/app-progress-${story.id}-${runSlug}`
        await page.goto(`/s/app-progress-${story.id}-${runSlug}?new=1&chat=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        await syncShareChatPromptFallback(page, promptBox, story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Progress guard: exact blocker, observable evidence, meaningful approval scope, and smallest reversible next step.')).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(progressGovernanceStories.length)
})
