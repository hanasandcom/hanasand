import type { extractBrowserPageContent } from './browserTaskAnalysis.ts'

type BrowserPageStructure = ReturnType<typeof extractBrowserPageContent>['structure']

export function reviewDesignQuality(html: string, excerpt: string, structure: BrowserPageStructure) {
    const lowerHtml = html.toLowerCase()
    const lowerText = excerpt.toLowerCase()
    const genericPhrases = [
        'unlock your potential',
        'transform your business',
        'seamless experience',
        'elevate your brand',
        'innovative solutions',
        'cutting edge',
        'all-in-one platform',
        'beautiful and modern',
        'powerful and easy',
        'next generation',
        'lorem ipsum',
    ]
    const genericPhraseCount = genericPhrases.filter((phrase) => lowerText.includes(phrase)).length
    const repeatedPatternCount = Math.max(
        countMatches(lowerHtml, /rounded-[a-z0-9/[\].-]+/g),
        countMatches(lowerHtml, /class=["'][^"']*(card|shadow|gradient)[^"']*["']/g),
    )
    const hasViewport = structure.hasViewportMeta
    const headingCount = structure.headings.length
    const hasForms = structure.forms.length > 0
    const hasSpecificCopy = excerpt.length > 260 && /\b(price|booking|client|case|service|team|deadline|location|domain|shipping|invoice|clinic|studio|restaurant|agency|project|portfolio)\b/i.test(excerpt)
    const hasDesignTokens = /--[a-z0-9-]+|design token|brand kit|palette|type scale|theme|style guide/i.test(html)
    const hasAssets = /<img\b|picture\b|svg\b|lucide|icon|asset|photo|image direction|brand asset/i.test(html)
    const hasMobileCare = /clamp\(|minmax\(|@media|viewport|flex-wrap|grid-template-columns/i.test(html)
    const issues = [
        genericPhraseCount ? 'Copy contains generic AI-builder phrases.' : null,
        repeatedPatternCount > 24 ? 'Layout may rely on repeated rounded cards, shadows, or gradient/card patterns.' : null,
        !hasViewport ? 'Missing viewport metadata for mobile proof.' : null,
        headingCount < 2 ? 'Page hierarchy is too thin to review confidently.' : null,
        !hasSpecificCopy ? 'Copy lacks business-specific detail.' : null,
        !hasDesignTokens ? 'No visible design-token, theme, palette, or style-guide direction.' : null,
        !hasAssets ? 'No asset, image, icon, or brand-media direction found.' : null,
        !hasMobileCare ? 'No clear responsive layout signals found.' : null,
        hasForms && !excerpt.match(/email|name|phone|message|booking|checkout|sign in|log in/i) ? 'Form purpose is unclear from visible copy.' : null,
    ].filter(Boolean) as string[]
    const criticalIssues = [
        !hasViewport ? 'mobile_viewport_missing' : null,
        genericPhraseCount >= 3 ? 'generic_copy_excessive' : null,
        repeatedPatternCount > 42 ? 'repeated_template_pattern_excessive' : null,
    ].filter(Boolean) as string[]
    const score = Math.max(0, Math.min(100, 100
        - genericPhraseCount * 9
        - Math.max(0, repeatedPatternCount - 16)
        - (hasViewport ? 0 : 16)
        - (headingCount >= 2 ? 0 : 10)
        - (hasSpecificCopy ? 0 : 12)
        - (hasDesignTokens ? 0 : 8)
        - (hasAssets ? 0 : 8)
        - (hasMobileCare ? 0 : 10)))
    return {
        score,
        issues,
        criticalIssues,
        repeatedPatternCount,
        genericPhraseCount,
        checks: {
            hasViewport,
            headingCount,
            hasSpecificCopy,
            hasDesignTokens,
            hasAssets,
            hasMobileCare,
            hasClearFormPurpose: !hasForms || !issues.includes('Form purpose is unclear from visible copy.'),
        },
    }
}

function countMatches(value: string, pattern: RegExp) {
    return [...value.matchAll(pattern)].length
}
