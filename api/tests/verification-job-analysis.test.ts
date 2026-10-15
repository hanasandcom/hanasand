import { expect, test } from 'bun:test'
import { analyzeBrowserPage } from '../src/handlers/tools/browserTaskAnalysis.ts'
import { reviewDesignQuality } from '../src/handlers/tools/verificationJobAnalysis.ts'

test('design review accepts specific copy with responsive and brand direction', () => {
    const html = '<meta name="viewport"><h1>Studio</h1><h2>Booking</h2><style>:root { --brand: navy } @media (max-width: 700px) { .layout { flex-wrap: wrap } }</style><img src="/studio.jpg">'
    const excerpt = `A studio for booking and client projects. ${'Our team handles each location and service with care. '.repeat(6)}`
    const result = reviewDesignQuality(html, excerpt, analyzeBrowserPage(html, 'https://example.com').structure)

    expect(result).toEqual({
        score: 100,
        issues: [],
        criticalIssues: [],
        repeatedPatternCount: 0,
        genericPhraseCount: 0,
        checks: {
            hasViewport: true,
            headingCount: 2,
            hasSpecificCopy: true,
            hasDesignTokens: true,
            hasAssets: true,
            hasMobileCare: true,
            hasClearFormPurpose: true,
        },
    })
})

test('design review retains the low-score and critical issue thresholds', () => {
    const html = '<h1>Welcome</h1><p>Unlock your potential. Transform your business. Seamless experience.</p>'
    const excerpt = 'Unlock your potential. Transform your business. Seamless experience.'
    const result = reviewDesignQuality(html, excerpt, analyzeBrowserPage(html, 'https://example.com').structure)

    expect(result.score).toBe(9)
    expect(result.criticalIssues).toEqual(['mobile_viewport_missing', 'generic_copy_excessive'])
    expect(result.issues).toEqual([
        'Copy contains generic AI-builder phrases.',
        'Missing viewport metadata for mobile proof.',
        'Page hierarchy is too thin to review confidently.',
        'Copy lacks business-specific detail.',
        'No visible design-token, theme, palette, or style-guide direction.',
        'No asset, image, icon, or brand-media direction found.',
        'No clear responsive layout signals found.',
    ])
})

test('design review applies repeated-pattern score and issue thresholds', () => {
    const baseHtml = '<meta name="viewport"><h1>Studio</h1><h2>Booking</h2><style>:root { --brand: navy } @media (max-width: 700px) { .layout { flex-wrap: wrap } }</style><img src="/studio.jpg">'
    const excerpt = `A studio for booking and client projects. ${'Our team handles each location and service with care. '.repeat(6)}`

    for (const count of [24, 25, 42, 43]) {
        const html = `${baseHtml}${'<div class="card"></div>'.repeat(count)}`
        const result = reviewDesignQuality(html, excerpt, analyzeBrowserPage(html, 'https://example.com').structure)

        expect(result.repeatedPatternCount).toBe(count)
        expect(result.score).toBe(100 - (count - 16))
        expect(result.issues.includes('Layout may rely on repeated rounded cards, shadows, or gradient/card patterns.')).toBe(count > 24)
        expect(result.criticalIssues.includes('repeated_template_pattern_excessive')).toBe(count > 42)
    }
})
