import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

import { joinPwnedSources } from './darkThemeSources.mjs'

export function checkDarkThemePublicRoutes(sources, violations) {
    const { loginPageClient, publicFooter, contactPage, sharePublicClient, shareRenderSite, uploadPreview } = sources
    const pwnedRouteCluster = joinPwnedSources(sources)
    for (const requiredPrivacyToken of [
        'checkedPrefix',
        'const prefix = hash.slice(0, 5)',
        'Only the first five characters are sent so no one can recreate your password.',
    ]) {
        if (!pwnedRouteCluster.includes(requiredPrivacyToken)) {
            violations.push(`pwned password check should disclose hash-prefix privacy behavior: ${requiredPrivacyToken}`)
        }
    }

    assertDarkThemeSurface({
        source: loginPageClient,
        requiredClasses: [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-warning',
        ],
        missingClassPrefix: 'login page should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g,
        bannedColorMessage: 'login page should not use one-off public page color utilities after palette migration',
    }, violations)


    assertDarkThemeSurface({
        source: publicFooter,
        requiredClasses: [
            'bg-ui-canvas',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-danger',
        ],
        missingClassPrefix: 'public footer should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g,
        bannedColorMessage: 'public footer should not use one-off public page color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: uploadPreview,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'upload preview should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        bannedColorMessage: 'upload preview should not use one-off upload form color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: contactPage,
        requiredClasses: [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ],
        missingClassPrefix: 'contact page should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        bannedColorMessage: 'contact page should not use one-off public page color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: sharePublicClient,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'text-ui-canvas',
        ],
        missingClassPrefix: 'public share client should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        bannedColorMessage: 'public share client should not use one-off share chrome color utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: shareRenderSite,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'bg-ui-border',
            'bg-ui-primary',
        ],
        missingClassPrefix: 'share renderer should use shared palette class ',
        bannedColorPattern: /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        bannedColorMessage: 'share renderer should not use one-off color utilities after palette migration',
    }, violations)
}
