import { expect, test } from 'bun:test'
import { analyzeBrowserPage, emptyBrowserPageAnalysis } from '../src/handlers/tools/browserTaskAnalysis.ts'

test('browser task analysis extracts readable text and page structure', () => {
    const html = `<!doctype html>
        <html><head><title>Demo &amp; status</title><meta name="viewport"></head>
        <body><h1>Dashboard</h1><p>Sample data is ready.</p>
        <a href="#details">Details</a><section id="details"></section>
        <form><label for="email">Email</label><input id="email" name="email">
        <button>Save</button></form><script>secret()</script><style>.hidden {}</style></body></html>`

    const result = analyzeBrowserPage(html, 'https://example.com/app')

    expect(result).toMatchObject({
        title: 'Demo & status',
        textExcerpt: 'Demo & status Dashboard Sample data is ready. Details Email Save',
        structure: {
            headings: ['Dashboard'],
            links: [{ text: 'Details', href: '#details' }],
            buttons: ['Save'],
            inputs: ['email / email'],
            forms: ['email / email | Save'],
            hasViewportMeta: true,
        },
        quality: {
            accessibilityBasics: {
                hasTitle: true,
                hasH1: true,
                hasViewportMeta: true,
                unlabeledControls: [],
                imagesWithoutAlt: [],
            },
            brokenLinkBasics: { checked: 1, issues: [] },
            criticalJourneySignals: {
                forms: 1,
                buttons: 1,
                dashboardCrud: true,
                sampleDataClaim: true,
            },
        },
    })
    expect(result.quality.notVerified).toContain('JavaScript runtime errors')
})

test('browser task analysis reports missing labels, alt text, and broken links', () => {
    const result = analyzeBrowserPage(
        '<title>Example</title><a href="#missing">Jump</a><a href="">Empty link</a><input name="search"><img src="/logo.svg">',
        'https://example.com/',
    )

    expect(result.quality.accessibilityBasics.unlabeledControls).toEqual(['search / input'])
    expect(result.quality.accessibilityBasics.imagesWithoutAlt).toEqual(['/logo.svg'])
    expect(result.quality.brokenLinkBasics).toEqual({
        checked: 2,
        issues: ['Jump -> #missing', 'Empty link -> <empty>'],
    })
})

test('empty analysis returns the failure response shape', () => {
    expect(emptyBrowserPageAnalysis()).toMatchObject({
        title: null,
        textExcerpt: '',
        structure: { headings: [], links: [], buttons: [], inputs: [], forms: [], hasViewportMeta: false },
        quality: {
            accessibilityBasics: { hasTitle: false, hasH1: false, hasViewportMeta: false },
            brokenLinkBasics: { checked: 0, issues: [] },
            criticalJourneySignals: {
                forms: 0,
                buttons: 0,
                auth: false,
                checkout: false,
                booking: false,
                dashboardCrud: false,
                liveDataClaim: false,
                sampleDataClaim: false,
            },
            notVerified: ['Browser target did not load', 'Production build output', 'JavaScript runtime errors', 'Mobile rendered viewport', 'Critical journeys'],
        },
    })
})
