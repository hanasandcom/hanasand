
import { joinPwnedSources } from './darkThemeSources.mjs'

export function checkDarkThemeProductRoutes(sources, violations) {
    const { pricingPage, testPageClient, cronPageClient, dashboardPage, galleryPageClient, trafficMap, trafficMapPrimitives } = sources

    for (const required of [
        'bg-ui-canvas',
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
    ]) {
        if (!pricingPage.includes(required)) {
            violations.push(`pricing page should use shared palette class ${required}`)
        }
    }

    const bannedPricingPageColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
    if (bannedPricingPageColor.test(pricingPage)) {
        violations.push('pricing page should not use one-off public-page color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'stroke-ui-success',
        'stroke-ui-danger',
        'text-ui-canvas',
    ]) {
        if (!testPageClient.includes(required)) {
            violations.push(`test launcher page should use shared palette class ${required}`)
        }
    }

    const bannedTestPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|stroke)-\[#|\b(?:bg|text|border|ring|outline|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\b|\b(?:bg|text|border|ring|outline|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|slate|zinc|neutral|gray)\//g
    if (bannedTestPageClientColor.test(testPageClient)) {
        violations.push('test launcher page should not use one-off public test color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
    ]) {
        if (!cronPageClient.includes(required)) {
            violations.push(`cron jobs dashboard page should use shared palette class ${required}`)
        }
    }

    const bannedCronPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g
    if (bannedCronPageClientColor.test(cronPageClient)) {
        violations.push('cron jobs dashboard page should not use one-off dashboard color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-success',
    ]) {
        if (!dashboardPage.includes(required)) {
            violations.push(`dashboard root page should use shared palette class ${required}`)
        }
    }

    const bannedDashboardPageColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g
    if (bannedDashboardPageColor.test(dashboardPage)) {
        violations.push('dashboard root page should not use one-off dashboard color utilities after palette migration')
    }

    for (const required of [
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
    ]) {
        if (!galleryPageClient.includes(required)) {
            violations.push(`gallery page should use shared palette class ${required}`)
        }
    }

    const bannedGalleryPageClientColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|bright)\//g
    if (bannedGalleryPageClientColor.test(galleryPageClient)) {
        violations.push('gallery page should not use one-off public page color utilities after palette migration')
    }

    for (const required of [
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
    ]) {
        if (!trafficMap.includes(required) && !trafficMapPrimitives.includes(required)) {
            violations.push(`traffic map surface should use shared palette class ${required}`)
        }
    }

    const bannedTrafficMapSurfaceColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow|fill|stroke)-\[#|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
    if (bannedTrafficMapSurfaceColor.test(`${trafficMap}\n${trafficMapPrimitives}`)) {
        violations.push('traffic map surface should not use one-off map color utilities after palette migration')
    }

    const pwnedRouteCluster = joinPwnedSources(sources)
    for (const required of [
        'bg-ui-canvas',
        'bg-ui-panel',
        'bg-ui-raised',
        'border-ui-border',
        'text-ui-text',
        'text-ui-muted',
        'text-ui-primary',
        'text-ui-success',
    ]) {
        if (!pwnedRouteCluster.includes(required)) {
            violations.push(`pwned password check surface should use shared palette class ${required}`)
        }
    }

    const bannedPwnedSurfaceColor = /#[0-9a-fA-F]{3,8}|rgba\(|\b(?:bg|text|border|ring|outline|shadow)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\b|\b(?:bg|text|border|ring|outline)-(?:white|black|red|orange|amber|yellow|green|emerald|blue|sky|slate|zinc|neutral|gray|rose|bright)\//g
    if (bannedPwnedSurfaceColor.test(pwnedRouteCluster)) {
        violations.push('pwned password check surface should not use one-off public page color utilities after palette migration')
    }

    for (const rawSecretPattern of [
        /body:\s*JSON\.stringify\(\{\s*password\s*\}\)/,
        /ws\.send\(JSON\.stringify\(\{\s*password\s*\}\)\)/,
    ]) {
        if (rawSecretPattern.test(pwnedRouteCluster)) {
            violations.push('pwned password check should not send the raw password from the browser')
        }
    }
}
