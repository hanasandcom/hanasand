import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceChat } from './helpers'

test.describe.configure({ mode: 'serial' })

test('share chat keeps Ask read-only and Build reviewable without showing raw code first', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await mockShareApi(page, { fallbackId: 'ask-build-workflow', initialContent: '<main><h1>Starter page</h1></main>' })

    const workflowRequests: string[] = []
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { context?: string }
        const contextPayload = JSON.parse(body.context || '{}') as { workflow?: string, writesAllowed?: boolean }
        workflowRequests.push(`${contextPayload.workflow}:${contextPayload.writesAllowed}`)
        if (contextPayload.workflow === 'ask') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'This is a starter page. Ask mode can explain it without changing files.',
                }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    '```tsx',
                    'export default function Page() { return <main className="raw-code">Hidden</main> }',
                    '```',
                    'Prepared a cleaner landing page.',
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: 'export default function Page() { return <main><h1>Cleaner landing page</h1></main> }',
                    })}</hanasand-tool>`,
                ].join('\n'),
            }),
        })
    })

    await page.goto('/s/ask-build-workflow?new=1')
    await openWorkspaceChat(page)

    await page.getByRole('button', { name: 'Ask' }).click()
    await expect(page.getByText('Ask mode will not change files.')).toBeVisible()
    await expect(page.getByText('Build is opt-in.')).toHaveCount(0)
    await page.getByPlaceholder('Ask about this project...').fill('explain what this is')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })
    await expect.poll(() => workflowRequests).toEqual(['ask:false'])
    await expect(page.getByText('What changed')).toHaveCount(0)

    await page.getByRole('button', { name: 'Build' }).click()
    await expect(page.getByText('Build is opt-in.')).toBeVisible()
    await expect(page.getByText('No files change until you approve the What changed cards.')).toBeVisible()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make it better')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect.poll(() => workflowRequests).toEqual(['ask:false', 'build:true'])
    await expect(page.getByText('Prepared a cleaner landing page.')).toBeVisible()
    await expect(page.getByText('Open What changed for the summary. Advanced diffs stay collapsed for developers.')).toBeVisible()
    await expect(page.getByText('What changed', { exact: true })).toBeVisible()
    await expect(page.getByText('Updated the visible website')).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'Prepared a cleaner landing page.' }).getByText('export default function Page')).toHaveCount(0)
    await expect(page.getByText('hanasand-tool')).not.toBeVisible()
})

test('share chat flags generic AI-looking design and remembers brand style cues', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await mockShareApi(page, { fallbackId: 'ask-build-workflow', initialContent: '<main><h1>Starter page</h1></main>' })

    let run = 0
    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string }
        const contextPayload = JSON.parse(body.context || '{}') as { designDifferentiationMode?: boolean, designMemory?: { tokens?: string[] } | null }
        expect(contextPayload.designDifferentiationMode).toBe(true)
        if (run === 1) {
            expect(contextPayload.designMemory?.tokens || []).toContain('premium')
        }
        run += 1

        const genericContent = [
            'export default function Page() {',
            'return <main className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 text-white">',
            '<section className="rounded-3xl border bg-white/10 shadow-2xl"><h1>Unlock your potential</h1></section>',
            '<article className="rounded-3xl border bg-white/10 shadow-2xl">Powerful platform</article>',
            '<article className="rounded-3xl border bg-white/10 shadow-2xl">Seamless experience</article>',
            '<article className="rounded-3xl border bg-white/10 shadow-2xl">Built for modern teams</article>',
            '</main> }',
        ].join('\n')
        const distinctContent = [
            'export const brandTokens = { "--studio-ink": "#15120f", "--studio-paper": "#f8f1e7", "--studio-copper": "#a45d32" }',
            'export default function Page() {',
            'return <main style={brandTokens} className="mx-auto grid max-w-5xl gap-8 px-5 py-8 text-[var(--studio-ink)]">',
            '<section className="grid gap-4 border-l-4 border-[var(--studio-copper)] pl-5"><h1>Premium studio intake with a calm editorial rhythm</h1><p>Art direction: warm atelier photography, quiet copper icons, honest project limits.</p></section>',
            '<img src="/studio-workbench.jpg" alt="Studio workbench with project materials" />',
            '</main> }',
        ].join('\n')

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    run === 1 ? 'Prepared visual direction.' : 'Refined the studio brand direction.',
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: run === 1 ? genericContent : distinctContent,
                    })}</hanasand-tool>`,
                    run === 1 ? '' : `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'docs/brand-kit.md',
                        content: 'Brand kit: premium studio palette, warm atelier photo direction, quiet copper icons, and theme tokens for future edits.',
                    })}</hanasand-tool>`,
                ].join('\n'),
            }),
        })
    })

    await page.goto('/s/design-quality-workflow?new=1')
    await openWorkspaceChat(page)
    await page.getByRole('button', { name: 'Build' }).click()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make this premium and not look AI-generated')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Design quality')).toBeVisible()
    await expect(page.getByText('Design risks looking generic or AI-generated.').first()).toBeVisible()
    await expect(page.getByText(/generic AI-builder phrases/i)).toBeVisible()

    await page.getByRole('button', { name: 'Discard' }).click()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make it distinct with brand tokens and asset direction')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Design memory')).toBeVisible()
    await expect(page.getByText('premium', { exact: true })).toBeVisible()
    await expect(page.getByText('Design has specific tokens, assets, hierarchy, and responsive signals.').first()).toBeVisible()
})
