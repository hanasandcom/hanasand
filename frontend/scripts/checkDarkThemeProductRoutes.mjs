import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'
import { joinPwnedSources } from './darkThemeSources.mjs'

export function checkDarkThemeProductRoutes(sources, violations) {
    const { pricingPage, testPageClient, cronPageClient, dashboardPage, galleryPageClient, trafficMap, trafficMapPrimitives } = sources

    assertDarkThemeSurface(pricingPage, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'pricing page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g,
        'pricing page should not use one-off public-page color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(testPageClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'stroke-ui-success',
            'stroke-ui-danger',
            'text-ui-canvas',
        ], 'test launcher page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g,
        'test launcher page should not use one-off public test color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(cronPageClient, [
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'cron jobs dashboard page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g,
        'cron jobs dashboard page should not use one-off dashboard color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(dashboardPage, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-success',
        ], 'dashboard root page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g,
        'dashboard root page should not use one-off dashboard color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(galleryPageClient, [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
        ], 'gallery page should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g,
        'gallery page should not use one-off public page color utilities after palette migration', violations,
    )

    assertDarkThemeSurface(`${trafficMap}\n${trafficMapPrimitives}`, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
            'fill-ui-text',
            'fill-ui-warning',
            'stroke-ui-border',
        ], 'traffic map surface should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|fill|stroke)-\[#|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g,
        'traffic map surface should not use one-off map color utilities after palette migration', violations,
        [trafficMap, trafficMapPrimitives],
    )

    const pwnedRouteCluster = joinPwnedSources(sources)
    assertDarkThemeSurface(pwnedRouteCluster, [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ], 'pwned password check surface should use shared palette class ',
        /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g,
        'pwned password check surface should not use one-off public page color utilities after palette migration', violations,
    )

    for (const rawSecretPattern of [
        /body:\s*JSON\.stringify\(\{\s*password\s*\}\)/,
        /ws\.send\(JSON\.stringify\(\{\s*password\s*\}\)\)/,
    ]) {
        if (rawSecretPattern.test(pwnedRouteCluster)) {
            violations.push('pwned password check should not send the raw password from the browser')
        }
    }
}
