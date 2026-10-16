import { expect, test } from '@playwright/test'
import { addLocalAuthCookies, mockShareApi, openWorkspaceChat } from './helpers'

test.describe.configure({ mode: 'serial' })

test('share chat sends niche design briefs and expects brand kit asset guidance', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await mockShareApi(page, { fallbackId: 'ask-build-workflow', initialContent: '<main><h1>Starter page</h1></main>' })

    await page.route('**/api/backend/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { context?: string, prompt?: string }
        const contextPayload = JSON.parse(body.context || '{}') as {
            designBrief?: {
                businessType?: string
                assetPipeline?: string[]
                tokenPlan?: string[]
                templateCaveat?: string
            }
        }
        expect(contextPayload.designBrief?.businessType).toBe('restaurant')
        expect(contextPayload.designBrief?.assetPipeline?.join(' ')).toContain('dietary')
        expect(contextPayload.designBrief?.tokenPlan?.join(' ')).toContain('appetite')
        expect(contextPayload.designBrief?.templateCaveat).toContain('not a fixed template')

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    'Prepared a restaurant direction with assets.',
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: [
                            'export const tokens = { "--restaurant-paper": "#fff8ed", "--restaurant-ink": "#23160f", "--restaurant-tomato": "#b73f2e" }',
                            'export default function Page() {',
                            'return <main style={tokens} className="mx-auto grid max-w-5xl gap-7 px-5 py-8 text-[var(--restaurant-ink)]">',
                            '<section className="grid gap-3 border-l-4 border-[var(--restaurant-tomato)] pl-5"><h1>Neighborhood bistro menu with honest allergy notes</h1><p>Hours, menu highlights, location, and dietary caveats stay visible before any inquiry.</p></section>',
                            '<img src="/restaurant-counter.jpg" alt="Restaurant counter with seasonal plates" />',
                            '</main> }',
                        ].join('\n'),
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'docs/brand-kit.md',
                        content: [
                            '# Brand kit',
                            'Theme tokens: restaurant-paper, restaurant-ink, restaurant-tomato.',
                            'Asset pipeline: real food and interior photos, dietary icons, no fake ordering or booking.',
                            'Image direction: warm counter photography, menu detail shots, staff-approved captions.',
                            'Template note: this is a starting direction, not a locked restaurant template.',
                        ].join('\n'),
                    })}</hanasand-tool>`,
                ].join('\n'),
            }),
        })
    })

    await page.goto('/s/restaurant-design-workflow?new=1')
    await openWorkspaceChat(page)
    await page.getByRole('button', { name: 'Build' }).click()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make a restaurant site that does not look like a generic AI template')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Design memory')).toBeVisible()
    await expect(page.getByText('restaurant', { exact: true })).toBeVisible()
    await expect(page.getByText('Updated the project instructions')).toBeVisible()
    await expect(page.getByText('Design has specific tokens, assets, hierarchy, and responsive signals.').first()).toBeVisible()
})
