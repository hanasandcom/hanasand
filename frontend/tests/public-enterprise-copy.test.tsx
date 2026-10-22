// @ts-expect-error Bun supplies this test module at runtime.
import { expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

mock.module('next/navigation', () => ({ usePathname: () => '/' }))

const { default: PricingPage } = await import('../src/app/pricing/page')
const { default: DevelopersPage } = await import('../src/app/developers/page')
const { default: PwnedPage } = await import('../src/app/pwned/page')
const { default: sitemap } = await import('../src/app/sitemap')
const { PublicDesktopNavigation } = await import('../src/components/header/publicNavigation')
const { default: Footer } = await import('../src/components/footer/footer')
const originalFetch = globalThis.fetch

function visibleText(markup: string) {
    return markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
}

test('pricing and developer pages render their public buyer copy', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
        info: { title: 'Hanasand Threat Intelligence API', version: '1.0.0' },
        servers: [{ url: 'https://api.hanasand.com/api/v1' }],
        paths: { '/actors': { get: { summary: 'Search threat actors', security: [{ ApiKey: [] }] } } },
        components: { securitySchemes: { ApiKey: { name: 'X-API-Key' } }, responses: {} },
    }), { status: 200, headers: { 'content-type': 'application/json' } })

    try {
        const pricingMarkup = renderToStaticMarkup(createElement(PricingPage))
        const pricing = visibleText(pricingMarkup)
        const developers = visibleText(renderToStaticMarkup(await DevelopersPage()))

        expect(pricing).toContain('Know more. Respond faster.')
        expect(pricing).toContain('Search threats. Watch your exposure. Scan your attack surface. Investigate what you find.')
        for (const plan of ['Threat Intelligence', 'Dark Web Monitoring', 'Security Scanner']) expect(pricing).toContain(plan)
        expect(pricing).not.toContain('Browser')
        expect(pricing).toContain('Container host options')
        expect(pricing).toContain('Automatic failover')
        expect(pricing).not.toContain('Always running')
        const planSectionIndex = pricingMarkup.indexOf('aria-label="Available plans"')
        const containerOptionsIndex = pricingMarkup.indexOf('Container host options')
        expect(planSectionIndex).toBeGreaterThanOrEqual(0)
        expect(containerOptionsIndex).toBeGreaterThan(planSectionIndex)
        expect(pricingMarkup).toContain('href="/api/billing/checkout?plan=monitoring"')

        const pwned = renderToStaticMarkup(await PwnedPage())
        const pwnedCopy = visibleText(pwned)
        expect(pwnedCopy).toContain('SHA-1 hash')
        expect(pwnedCopy).toContain('Hash your password and check it.')
        expect(pwned).toContain('placeholder="40-character SHA-1 hash"')
        expect(sitemap().some(route => route.url === 'https://hanasand.com/pwned')).toBe(true)

        expect(developers).toContain('Hanasand Threat Intelligence API')
        expect(developers).toContain('Organization, API key, first request.')
        expect(developers).toContain('Search threat actors')
        expect(developers).toContain('X-API-Key')
        expect(developers).toContain('Responses include')

        const bannedVisibleTone = [
            /fake badges/i, /mystery roadmap/i, /scraped volume/i, /should win/i,
            /vanity feed/i, /bulk scraped-row/i, /raw leaked-data bloat/i,
            /vague claims/i, /launch-readiness/i, /readiness checks/i,
        ]
        for (const pattern of bannedVisibleTone) {
            expect(pricing, `pricing should avoid ${pattern}`).not.toMatch(pattern)
            expect(developers, `developers should avoid ${pattern}`).not.toMatch(pattern)
        }
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('public header navigation and footer render the buyer destinations', () => {
    const headerMarkup = renderToStaticMarkup(createElement(PublicDesktopNavigation, { pricingHref: '/pricing' }))
    const header = visibleText(headerMarkup)
    const footer = renderToStaticMarkup(createElement(Footer))

    expect(header).toContain('Check Password')
    expect(headerMarkup).toContain('href="/pwned"')
    expect(header).toContain('Pricing')
    expect(headerMarkup).toContain('href="/developers"')
    expect(footer).toContain('aria-label="Footer"')
    expect(footer).toContain('Check Password')
    expect(footer).toContain('href="/pwned"')
    for (const label of ['About', 'Contact', 'Pricing']) expect(footer).toContain(label)
    expect(footer).not.toContain('Eirik')
    expect(footer).not.toContain('Articles')
    expect(footer).not.toContain('Readiness')
})
