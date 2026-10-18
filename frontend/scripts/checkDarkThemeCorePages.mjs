import { assertDarkThemeSurface } from './darkThemeSurfaceAssertions.mjs'

export function checkDarkThemeCorePages(sources, violations) {
    const { cookieSettings, darkwebIndex, publicHeader, statusClient, subscriptionPage, tiActivityPage } = sources
    assertDarkThemeSurface({
        source: cookieSettings,
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
        missingClassPrefix: 'cookie-settings page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border)-\[#/g,
        bannedColorMessage: 'cookie-settings page should not use one-off hex Tailwind colors after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: darkwebIndex,
        requiredClasses: [
            'bg-ui-canvas',
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
        ],
        missingClassPrefix: 'TI darkweb index page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border)-\[#/g,
        bannedColorMessage: 'TI darkweb index page should not use one-off hex Tailwind colors after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: publicHeader,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'bg-ui-text',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-canvas',
        ],
        missingClassPrefix: 'public header should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border)-\[#|\b(?:bg|text|border)-(?:white|black)\//g,
        bannedColorMessage: 'public header should not use one-off hex or white/black opacity Tailwind colors after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: statusClient,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ],
        missingClassPrefix: 'public status page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'public status page should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: subscriptionPage,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
        ],
        missingClassPrefix: 'subscription dashboard page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'subscription dashboard page should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    assertDarkThemeSurface({
        source: tiActivityPage,
        requiredClasses: [
            'bg-ui-panel',
            'bg-ui-raised',
            'border-ui-border',
            'text-ui-text',
            'text-ui-muted',
            'text-ui-primary',
            'text-ui-success',
            'text-ui-warning',
        ],
        missingClassPrefix: 'TI activity page should use shared palette class ',
        bannedColorPattern: /\b(?:bg|text|border|ring|outline)-\[#|\b(?:bg|text|border|ring|outline)-(?:white|black)\//g,
        bannedColorMessage: 'TI activity page should not use one-off color Tailwind utilities after palette migration',
    }, violations)

    // The legacy TI audit route redirects to the active management audit route;
    // it has no rendered surface to check here.
}
