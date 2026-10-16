import type { Page } from '@playwright/test'

export async function installAiApiRoutes(page: Page, setVmName: (name: string) => void) {
    await page.route('**/api/ai/conversations', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.route(/.*\/api\/ai\/conversations\/[^/]+$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.route(/.*\/api\/ai\/conversations\/[^/]+\/messages$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.route(/.*\/api\/(?:backend\/)?tools\/http\/request$/, async (route) => {
        const body = route.request().postDataJSON() as { url?: string, method?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                status: 200,
                url: body.url,
                method: body.method || 'GET',
                body: '<html><title>Preview OK</title><main>Ready</main></html>',
            }),
        })
    })

    await page.route(/.*\/api\/(?:backend\/)?tools\/browser\/task$/, async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                url: body.url || 'https://example.com',
                title: 'Preview OK',
                textExcerpt: 'Ready preview with visible hero, CTA, pricing, and mobile-friendly content.',
                structure: {
                    headings: ['Ready preview', 'Pricing', 'Contact'],
                    links: [
                        { text: 'Contact support', href: '/contact' },
                        { text: 'Pricing', href: '/pricing' },
                    ],
                    buttons: ['Get started', 'Book demo'],
                    inputs: ['Email address / email'],
                    forms: ['Email address / email | Get started'],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    await page.route('**/api/vm', async (route) => {
        const body = route.request().postDataJSON() as { name?: string }
        setVmName(body.name || '')
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ message: `Created VM ${body.name || ''}` }),
        })
    })

}
