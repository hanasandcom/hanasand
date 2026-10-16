import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { costControlStories, deploymentDiagnosticStories } from './fixtures/changeReview'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI switches to deployment diagnostics for real hosting failures', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-deploy-diagnostic-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = deploymentDiagnosticStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-deploy-diagnostic-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Deployment diagnostic mode:')
        expect(body.prompt).toContain('do not guess and do not edit first')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"diagnosticMode":true')
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}.`,
                    'Diagnostic checklist: target URL, environment scope, last changed config/package files, exact build/runtime log evidence, and the smallest safe next check.',
                    'No edit yet; missing deploy evidence would make this a guess.',
                ].join('\n'),
            }),
        })
    })

    for (const story of deploymentDiagnosticStories) {
        const expectedUrl = `https://hanasand.com/s/app-deploy-diagnostic-${story.id}-${runSlug}`
        await page.goto(`/s/app-deploy-diagnostic-${story.id}-${runSlug}?new=1&chat=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        await page.locator('input[name="shareChatPromptFallback"]').evaluate((element, value) => {
            (element as HTMLInputElement).value = value
        }, story.prompt)
        await promptBox.dispatchEvent('input')
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Diagnostic checklist: target URL, environment scope, last changed config/package files, exact build/runtime log evidence, and the smallest safe next check.')).toBeVisible()
        await expect(page.getByText('No edit yet; missing deploy evidence would make this a guess.')).toBeVisible()
        await expect(page.getByText('1 pending change')).not.toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).not.toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(deploymentDiagnosticStories.length)
})
test('share page AI protects budget and scope for real product-regression prompts', async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await addLocalAuthCookies(context, baseURL)
    const runSlug = `r${Date.now()}`

    await mockShareApi(page, { fallbackId: 'app-cost-control-story' })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string, maxTokens?: number }
        const matchingStory = costControlStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-cost-control-${matchingStory!.id}-${runSlug}`
        expect(body.maxTokens).toBe(2200)
        expect(body.prompt).toContain('Cost control mode:')
        expect(body.prompt).toContain('Preserve the current project shape')
        expect(body.prompt).toContain('smallest cohesive edit')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain('"costControlMode":true')
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}.`,
                    'Scope guard: preserve existing layout, touch only the named file, and avoid a rewrite.',
                    '<hanasand-tool>{"action":"upsert_share","path":"src/app/page.tsx","content":"export default function Page() { return <main>Small safe fix</main> }"}</hanasand-tool>',
                ].join('\n'),
            }),
        })
    })

    for (const story of costControlStories) {
        const expectedUrl = `https://hanasand.com/s/app-cost-control-${story.id}-${runSlug}`
        await page.goto(`/s/app-cost-control-${story.id}-${runSlug}?new=1&chat=1`)
        const promptBox = await openWorkspaceBuildPrompt(page)
        await promptBox.fill(story.prompt)
        await page.locator('input[name="shareChatPromptFallback"]').evaluate((element, value) => {
            (element as HTMLInputElement).value = value
        }, story.prompt)
        await promptBox.dispatchEvent('input')
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click({ force: true })

        await expect(page.getByText(`Ready: ${story.expected}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Scope guard: preserve existing layout, touch only the named file, and avoid a rewrite.')).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText(expectedUrl).first()).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
        await page.getByRole('button', { name: 'Discard' }).click()
    }

    expect(handledPrompts).toHaveLength(costControlStories.length)
})
