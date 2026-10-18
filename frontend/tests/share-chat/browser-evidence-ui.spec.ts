import { expect, test } from '@playwright/test'
import { fulfillAiReply } from './fulfillAiReply'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt } from './helpers'
import { shareBrowserEvidenceStories, shareEvidenceTargetStories } from './fixtures/browserTargets'
import { browserTaskResult } from './fixtures/browserTaskResult'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI shows browser proof in the website UI for ambiguous build stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-share-browser-proof-story' })

    await page.route('**/api/backend/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(browserTaskResult({
                url: body.url || 'https://example.com',
                title: 'Share Preview OK',
                textExcerpt: 'Visible preview with hero, pricing, contact, booking caveat, and next step.',
                headings: ['Visible preview', 'Pricing', 'Contact'],
                links: [
                    { text: 'Contact support', href: '/contact' },
                    { text: 'Pricing', href: '/pricing' },
                ],
                buttons: ['Start review', 'Book demo'],
                inputs: ['Email address / email'],
                forms: ['Email address / email | Start review'],
                screenshotPath: null,
            })),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = shareBrowserEvidenceStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.prompt).toContain('Use browser evidence before claiming a page works')
        expect(body.context?.length || 0).toBeLessThan(9_000)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. Browser proof is visible before apply.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'browser_task',
                    url: 'https://example.com',
                    captureScreenshot: true,
                    timeoutMs: 16000,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Visible proof first, careful claims, no fake backend promises.</p></main> }`,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/proof.ts',
                    content: `export const proof = { browser: true, apply: 'manual', topic: '${matchingStory!.expected}' }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of shareBrowserEvidenceStories) {
        await page.goto(`/s/app-share-browser-proof-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Browser proof is visible before apply.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Production proof visible for https://example.com.')).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Browser proof', { exact: true }).last()).toBeVisible()
        await expect(page.getByText('Visible preview').last()).toBeVisible()
        await expect(page.getByText('Contact support -> /contact').last()).toBeVisible()
        await expect(page.getByText('Viewport meta present').last()).toBeVisible()
        await expect(page.getByText('Screenshot not available yet').last()).toBeVisible()
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/proof.ts')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(shareBrowserEvidenceStories.length)
})
test('share page AI uses the current share URL for browser evidence instead of generic examples', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-share-evidence-target-story' })

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-share-target-')
        expect(body.url).not.toBe('https://example.com')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(browserTaskResult({
                url: body.url,
                title: 'Current Share Evidence',
                textExcerpt: 'Current share proof with visible navigation and no generic sample target.',
                headings: ['Current share proof', 'Visible next step'],
                links: [{ text: 'Open share', href: body.url }],
                buttons: ['Apply after review'],
                screenshotPath: null,
            })),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = shareEvidenceTargetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-share-target-${matchingStory!.id}`
        expect(body.prompt).toContain('Browser evidence targets:')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.prompt).toContain(`"url":"${expectedUrl}"`)
        expect(body.prompt).not.toContain('"url":"https://example.com"')
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await fulfillAiReply(route, {
            message: [
                `Ready: ${matchingStory!.expected}. I checked the current share URL, not a sample page.`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'browser_task',
                    url: expectedUrl,
                    captureScreenshot: true,
                    timeoutMs: 16000,
                })}</hanasand-tool>`,
                `<hanasand-tool>${JSON.stringify({
                    action: 'upsert_share',
                    path: 'app/page.tsx',
                    content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Current-share evidence first, then manual apply.</p></main> }`,
                })}</hanasand-tool>`,
            ].join('\n\n'),
        })
    })

    for (const story of shareEvidenceTargetStories) {
        await page.goto(`/s/app-share-target-${story.id}?new=1`)
        await openWorkspaceBuildPrompt(page)
        await page.getByPlaceholder('Describe what you want to build or change...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. I checked the current share URL, not a sample page.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof visible for https://hanasand.com/s/app-share-target-${story.id}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Current share proof').last()).toBeVisible()
        await expect(page.getByText(`Open share -> https://hanasand.com/s/app-share-target-${story.id}`).last()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(shareEvidenceTargetStories.length)
})
