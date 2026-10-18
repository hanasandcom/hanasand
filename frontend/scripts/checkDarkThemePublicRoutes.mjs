import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

import { joinPwnedSources } from './darkThemeSources.mjs'

export function checkDarkThemePublicRoutes(sources, violations) {
    const { loginPageClient, publicFooter, contactPage, sharePublicClient, shareRenderSite, uploadPreview } = sources
    const pwnedRouteCluster = joinPwnedSources(sources)
    for (const requiredPrivacyToken of [
        'checkedPrefix',
        'const prefix = hash.slice(0, 5)',
        'Only the first five characters leave this page.',
    ]) {
        if (!pwnedRouteCluster.includes(requiredPrivacyToken)) {
            violations.push(`pwned password check should disclose hash-prefix privacy behavior: ${requiredPrivacyToken}`)
        }
    }

    assertDarkThemeSurface(loginPageClient, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-warning',
        ], 'login page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g,
        'login page should not use one-off public page color utilities after palette migration', violations,
    )


    assertDarkThemeSurface(publicFooter, [
            'bg-ui-canvas',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-danger',
        ], 'public footer should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g,
        'public footer should not use one-off public page color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(uploadPreview, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ], 'upload preview should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        'upload preview should not use one-off upload form color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(contactPage, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'contact page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        'contact page should not use one-off public page color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(sharePublicClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'text-ui-canvas',
        ], 'public share client should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        'public share client should not use one-off share chrome color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(shareRenderSite, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'bg-ui-border',
            'bg-ui-primary',
        ], 'share renderer should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright|background)\//g,
        'share renderer should not use one-off color utilities after palette migration', violations,
    )
}
